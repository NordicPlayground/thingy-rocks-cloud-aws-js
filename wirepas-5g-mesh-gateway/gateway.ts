import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import mqtt from 'mqtt'
import { Event, notifyClients } from '../lambda/notifyClients.js'
import { decodePayload } from './decodePayload.js'
import { debug, error, log } from './log.js'
import { GenericMessage } from './protobuf/ts/generic_message.js'

const receiveOnly = process.env.RECEIVE_ONLY !== undefined
const counterMessageFlushInterval = parseInt(
	process.env.COUNTER_MESSAGE_FLUSH_INTERVAL_SECONDS ?? '60',
	10,
)
const counterMessageFlushPace = parseInt(
	process.env.COUNTER_MESSAGE_FLUSH_PACE_MS ?? '150',
	10,
)

const {
	connectionsTableName,
	websocketManagementAPIURL,
	accessKeyId,
	secretAccessKey,
	gatewayEndpoint,
} = fromEnv({
	connectionsTableName: 'GATEWAY_CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'GATEWAY_WEBSOCKET_MANAGEMENT_API_URL',
	gatewayEndpoint: 'GATEWAY_MQTT_ENDPOINT',
	accessKeyId: 'GATEWAY_AWS_ACCESS_KEY_ID',
	secretAccessKey: 'GATEWAY_AWS_SECRET_ACCESS_KEY',
})(process.env)

const region =
	new URL(websocketManagementAPIURL).hostname.split('.')[2] ?? 'us-west-2'
const auth = {
	region,
	credentials: {
		accessKeyId,
		secretAccessKey,
	},
}
const db = new DynamoDBClient({
	...auth,
})
const apiGwManagementClient = new ApiGatewayManagementApi({
	...auth,
	endpoint: websocketManagementAPIURL,
})

const notifier = notifyClients(
	{
		db,
		connectionsTableName,
		apiGwManagementClient,
	},
	receiveOnly,
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
			for (const { topic } of grants) log(`Subscribed to`, topic)
		})
	}
})

// Buffer counter messages and send them only once every minute, combined
let counterMessages: Record<string, Event> = {}

client.on('message', (_, message) => {
	const packetReceivedEvent =
		GenericMessage.fromBinary(message)?.wirepas?.packetReceivedEvent
	if (packetReceivedEvent !== undefined) {
		const {
			sourceAddress,
			rxTimeMsEpoch,
			sourceEndpoint,
			destinationEndpoint,
			payload,
			travelTimeMs,
			header: { gwId },
			hopCount,
		} = packetReceivedEvent

		// Only handle messages on the 1/1 endpoint
		if (sourceEndpoint !== 1 || destinationEndpoint !== 1) return

		// Only handle messages with payload
		if (payload === undefined) return

		const rxTime = new Date(parseInt(BigInt(rxTimeMsEpoch).toString()))
		const decodedPayload = decodePayload(payload)
		if (decodedPayload !== null) {
			const event: Event = {
				meshNodeEvent: {
					meta: {
						node: sourceAddress,
						gateway: gwId,
						rxTime,
						travelTimeMs,
						...(hopCount !== undefined ? { hops: hopCount } : {}),
					},
					message: decodedPayload,
				},
			}
			if ('counter' in decodedPayload) {
				counterMessages[`${sourceAddress}:${gwId}`] = event
			} else {
				notifier(event).catch((err) => {
					error(`[notifier]`, err)
				})
			}
		}
	}
})

// Regularly send buffered messages
setInterval(async () => {
	const eventsToSend = Object.values(counterMessages)
	counterMessages = {}
	for (const event of eventsToSend) {
		notifier(event).catch((err) => {
			error(`[notifier]`, err)
		})
		// Pace messages
		await new Promise((resolve) => setTimeout(resolve, counterMessageFlushPace))
	}
	counterMessages = {}
}, counterMessageFlushInterval * 1000)
debug(
	`Flushing counter messages every ${counterMessageFlushInterval} seconds with ${counterMessageFlushPace} ms pacing`,
)
