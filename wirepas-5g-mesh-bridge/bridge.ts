import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import mqtt from 'mqtt'
import path from 'node:path'
import protobuf from 'protobufjs'
import { notifyClients } from '../lambda/notifyClients.js'
import { decodePayload } from './decodePayload.js'
import { debug, error, log } from './log.js'

const {
	connectionsTableName,
	websocketManagementAPIURL,
	accessKeyId,
	secretAccessKey,
	bridgeEndpoint,
} = fromEnv({
	connectionsTableName: 'BRIDGE_CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'BRIDGE_WEBSOCKET_MANAGEMENT_API_URL',
	bridgeEndpoint: 'BRIDGE_MQTT_ENDPOINT',
	accessKeyId: 'BRIDGE_AWS_ACCESS_KEY_ID',
	secretAccessKey: 'BRIDGE_AWS_SECRET_ACCESS_KEY',
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

const notifier = notifyClients({
	db,
	connectionsTableName,
	apiGwManagementClient,
})

const root = await protobuf.load(
	path.join(
		process.cwd(),
		'wirepas-5g-mesh-bridge',
		'protobuf',
		'generic_message.proto',
	),
)

// Obtain a message type
const GenericMessage = root.lookupType(
	'wirepas.proto.gateway_api.GenericMessage',
)

const parsedEndpoint = new URL(bridgeEndpoint)
log(`Connecting to`, parsedEndpoint.hostname)

const client = mqtt.connect(bridgeEndpoint)

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

client.on('message', function (topic, message) {
	const packetReceivedEvent = (GenericMessage.decode(message) as any)?.wirepas
		?.packetReceivedEvent
	if (packetReceivedEvent !== undefined && packetReceivedEvent !== null) {
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

		debug(packetReceivedEvent)

		const rxTime = new Date(parseInt(BigInt(rxTimeMsEpoch).toString()))
		const decodedPayload = decodePayload(payload)
		if (decodedPayload !== null) {
			notifier({
				meshNodeEvent: {
					meta: {
						node: sourceAddress,
						gateway: gwId,
						rxTime,
						travelTimeMs,
						hops: hopCount,
					},
					message: decodedPayload,
				},
			}).catch((err) => {
				error(`[notifier]`, err)
			})
		}
	}
})
