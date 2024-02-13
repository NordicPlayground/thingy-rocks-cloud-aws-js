import { fromEnv } from '@nordicsemiconductor/from-env'
import mqtt from 'mqtt'
import { mqtt as awsMqtt } from 'aws-iot-device-sdk-v2'
import { debug, error, log } from './log.js'
import { GenericMessage } from './protobuf/ts/generic_message.js'
import {
	IoTDataPlaneClient,
	UpdateThingShadowCommand,
} from '@aws-sdk/client-iot-data-plane'
import {
	DescribeEndpointCommand,
	IoTClient,
	ListThingsCommand,
	type ThingAttribute,
} from '@aws-sdk/client-iot'
import { merge } from 'lodash-es'
import { decodePayload } from './decodePayload.js'
import { cloudToGateway } from './cloudToGateway.js'
import {
	LED_COLOR,
	LED_STATE,
	getLedState,
	setLEDColor,
	wirepasPublish,
} from './publish.js'
import chalk from 'chalk'
import pThrottle from 'p-throttle'

const throttle = pThrottle({
	limit: 1,
	interval: 250,
})

const { region, accessKeyId, secretAccessKey, gatewayEndpoint } = fromEnv({
	region: 'GATEWAY_REGION',
	gatewayEndpoint: 'GATEWAY_MQTT_ENDPOINT',
	accessKeyId: 'GATEWAY_AWS_ACCESS_KEY_ID',
	secretAccessKey: 'GATEWAY_AWS_SECRET_ACCESS_KEY',
})(process.env)

const stateFlushInterval = parseInt(
	process.env.STATE_FLUSH_INTERVAL_SECONDS ?? '60',
	10,
)

const auth = {
	region,
	credentials: {
		accessKeyId,
		secretAccessKey,
	},
}
const iotClient = new IoTClient(auth)
const iotDataClient = await (async () =>
	new IoTDataPlaneClient({
		...auth,
		endpoint: `https://${
			(
				await new IoTClient(auth).send(
					new DescribeEndpointCommand({
						endpointType: 'iot:Data-ATS',
					}),
				)
			).endpointAddress
		}`,
	}))()

// Find thing for gateway
const thingTypeName = 'wirepas-5g-mesh-gateway'
const { things: gateways } = await iotClient.send(
	new ListThingsCommand({
		thingTypeName,
	}),
)

const existingGws = (gateways ?? []).reduce(
	(list, gw) => ({ ...list, [gw.thingName as string]: gw }),
	{} as Record<string, ThingAttribute>,
)
Object.keys(existingGws).forEach((gwId) =>
	debug(`Known gateway things: ${gwId}`),
)

const parsedEndpoint = new URL(gatewayEndpoint)
log(`Connecting to`, parsedEndpoint.hostname)

const client = mqtt.connect(gatewayEndpoint)

const topics = ['gw-event/#']

client.on('connect', () => {
	log(`Connected.`)
	for (const topic of topics) {
		client.subscribe(topic, (err, grants) => {
			if (err !== null) {
				throw err
			}
			for (const { topic } of grants ?? []) log(`Subscribed to`, topic)
		})
	}
})

let nodes: Record<string, Record<string, any>> = {}
const ledState: Record<string, Record<string, boolean>> = {}

const getColor = throttle(
	async (gwId: string, node: number, color: LED_COLOR) =>
		sendToGateway({
			gateway: gwId,
			req: getLedState({
				node,
				color,
			}),
		}),
)

client.on('message', (_, message) => {
	const packetReceivedEvent =
		GenericMessage.fromBinary(message)?.wirepas?.packetReceivedEvent
	if (packetReceivedEvent !== undefined) {
		const {
			sourceAddress,
			rxTimeMsEpoch,
			payload,
			travelTimeMs,
			header: { gwId },
			qos,
			hopCount,
		} = packetReceivedEvent

		// Only handle messages with payload
		if (payload === undefined) return

		const rxTime = new Date(parseInt(BigInt(rxTimeMsEpoch).toString()))
		if (existingGws[gwId] === undefined) {
			error(
				`Unknown gateway: ${gwId}! Add a new IoT Thing with the name "${gwId}" and the thing type "${thingTypeName}".`,
			)
			return
		}

		// Query LED state of node
		if (ledState[gwId]?.[sourceAddress] === undefined) {
			ledState[gwId] = {
				...(ledState[gwId] ?? {}),
				[sourceAddress]: true,
			}
			void Promise.all([
				getColor(gwId, sourceAddress, LED_COLOR.RED),
				getColor(gwId, sourceAddress, LED_COLOR.GREEN),
				getColor(gwId, sourceAddress, LED_COLOR.BLUE),
			])
		}

		nodes[gwId] = merge(
			{
				[sourceAddress]: {
					lat: travelTimeMs,
					...(hopCount !== undefined ? { hops: hopCount } : {}),
					ts: rxTime,
					qos,
					payload: ((payload) => {
						try {
							return decodePayload(payload, (type, pos) => {
								debug(`Unknown message type`, type)
								debug(Buffer.from(payload).toString('hex'))
								debug('  '.repeat(Math.max(0, pos - 1)) + ' ^')
							})
						} catch {
							debug(
								`Failed to decode payload: ${Buffer.from(payload).toString('hex')}`,
							)
						}
						return {}
					})(payload),
				},
			},
			nodes[gwId],
		)
	}
})

// Regularly send buffered updates
setInterval(async () => {
	await Promise.all(
		Object.entries(nodes).map(async ([gwId, nodes]) => {
			Object.entries(nodes).forEach(([nodeId, data]) => {
				debug(gwId, nodeId, JSON.stringify(data))
			})

			return iotDataClient.send(
				new UpdateThingShadowCommand({
					thingName: gwId,
					payload: JSON.stringify({
						state: {
							reported: {
								nodes,
							},
						},
					}),
				}),
			)
		}),
	)
	nodes = {}
}, stateFlushInterval * 1000)
debug(`Flushing state every ${stateFlushInterval} seconds`)

// Handle configuration changes
const C2G = chalk.blue.dim('C2G')
const sendToGateway = wirepasPublish({
	client,
	debug: (...args) => debug(C2G, ...args),
})
const gwThingConnections: Record<string, awsMqtt.MqttClientConnection> = {}

const updateColor = throttle(
	async (gwId: string, node: number, color: LED_COLOR, ledState: LED_STATE) =>
		sendToGateway({
			gateway: gwId,
			req: setLEDColor({
				node,
				color,
				ledState,
			}),
		}),
)

for (const gwId of Object.keys(existingGws)) {
	gwThingConnections[gwId] = await cloudToGateway(iotDataClient, {
		debug: (...args) => debug(C2G, ...args),
		error: (...args) => error(C2G, ...args),
	})(gwId, async (desired) => {
		for (const [nodeId, { payload }] of Object.entries(desired.nodes)) {
			const node = parseInt(nodeId, 10)
			if ('led' in payload && payload.led !== undefined) {
				const { r, g, b } = payload.led
				const updates = []
				if (r !== undefined)
					updates.push(updateColor(gwId, node, LED_COLOR.RED, toState(r)))
				if (g !== undefined)
					updates.push(updateColor(gwId, node, LED_COLOR.GREEN, toState(g)))
				if (b !== undefined)
					updates.push(updateColor(gwId, node, LED_COLOR.BLUE, toState(b)))
				await Promise.all(updates)
			}
		}
	})
}

const toState = (state: boolean) => (state ? LED_STATE.ON : LED_STATE.OFF)
