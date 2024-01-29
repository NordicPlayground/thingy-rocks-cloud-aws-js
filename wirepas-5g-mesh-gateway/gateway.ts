import { fromEnv } from '@nordicsemiconductor/from-env'
import mqtt from 'mqtt'
import { decodePayload, type Wirepas5GMeshNodeEvent } from './decodePayload.js'
import { log } from './log.js'
import { GenericMessage } from './protobuf/ts/generic_message.js'
import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane'
import { DescribeEndpointCommand, IoTClient } from '@aws-sdk/client-iot'

const { region, accessKeyId, secretAccessKey, gatewayEndpoint } = fromEnv({
	region: 'GATEWAY_REGION',
	gatewayEndpoint: 'GATEWAY_MQTT_ENDPOINT',
	accessKeyId: 'GATEWAY_AWS_ACCESS_KEY_ID',
	secretAccessKey: 'GATEWAY_AWS_SECRET_ACCESS_KEY',
})(process.env)

const auth = {
	region,
	credentials: {
		accessKeyId,
		secretAccessKey,
	},
}
const iotClient = async () =>
	new IoTDataPlaneClient({
		...auth,
		endpoint: (
			await new IoTClient(auth).send(
				new DescribeEndpointCommand({
					endpointType: 'iot:Data-ATS',
				}),
			)
		).endpointAddress,
	})
// TODO: write updates to shadow
void iotClient

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
			const event: Wirepas5GMeshNodeEvent = {
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
			console.log(JSON.stringify({ event }))
			// TODO: write to shadow
		}
	}
})
