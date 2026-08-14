import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { IoTClient } from '@aws-sdk/client-iot'
import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane'
import { marshall } from '@aws-sdk/util-dynamodb'
import { fromEnv } from '@bifravst/from-env'
import { requestLogger } from '@hello.nrfcloud.com/lambda-helpers/requestLogger'
import { LwM2MObjectID } from '@hello.nrfcloud.com/proto-map/lwm2m'
import middy from '@middy/core'
import type { SQSEvent } from 'aws-lambda'
import { ulid } from 'ulidx'
import { parseCborWithIdAndSenML } from '../lwm2m/parseCborWithIdAndSenML.ts'
import { findLwM2MObject } from '../ntn-udp-payload/isNotEmpty.ts'
import { parse } from '../ntn-udp-payload/parse.ts'
import { notifyClients } from './notifyClients.ts'
import { updateShadow } from './updateShadow.ts'
import { withDeviceAlias } from './withDeviceAlias.ts'

const db = new DynamoDBClient({})
const iotData = new IoTDataPlaneClient({})
const iot = new IoTClient({})

const u = updateShadow(iotData)

const {
	connectionsTableName,
	websocketManagementAPIURL,
	udpDatagramsTableName,
} = fromEnv({
	connectionsTableName: 'CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
	udpDatagramsTableName: 'UDP_DATAGRAMS_TABLE_NAME',
})(process.env)

const apiGwManagementClient = new ApiGatewayManagementApi({
	endpoint: websocketManagementAPIURL,
})

const notifier = withDeviceAlias(iot)(
	notifyClients({
		db,
		connectionsTableName,
		apiGwManagementClient,
	}),
)

export const handler = middy<SQSEvent>()
	.use(requestLogger())
	.handler(async (event) => {
		for (const record of event.Records) {
			const messageId = ulid()
			const ttl = Math.round(Date.now() / 1000) + 60 * 60 * 24 * 7

			// Check source port from message attributes
			const sourcePort = parseInt(
				record.messageAttributes?.sourcePort?.stringValue ?? '6666',
				10,
			)

			// Parse payload based on source port
			let deviceId: string
			let maybeLwM2M: ReturnType<typeof parse>
			if (sourcePort === 6667) {
				// Port 6667: CBOR-encoded SenML containing LwM2M objects
				const result = parseCborWithIdAndSenML(record.body)
				if ('error' in result) {
					console.debug(
						messageId,
						`Failed to parse CBOR SenML: ${result.error.message}`,
					)
					await db.send(
						new PutItemCommand({
							TableName: udpDatagramsTableName,
							Item: marshall({
								deviceId: 'unknown',
								messageId,
								datagram: record.body,
								ok: false,
								error: `Failed to parse CBOR SenML: ${result.error.message}`,
								ttl,
							}),
						}),
					)
					continue
				}
				maybeLwM2M = result.lwm2m
				deviceId = result.deviceId
			} else {
				// Port 6666: Plain text CSV format
				maybeLwM2M = parse(record.body)

				// Extract device ID from LwM2M Device Information object
				deviceId = findLwM2MObject(
					maybeLwM2M ?? [],
					LwM2MObjectID.DeviceInformation_14204,
				)?.Resources[0] as string
			}

			if (deviceId === null) {
				console.debug(
					messageId,
					`Failed to parse device info from: ${record.body}`,
				)
				await db.send(
					new PutItemCommand({
						TableName: udpDatagramsTableName,
						Item: marshall({
							deviceId: 'unknown',
							messageId,
							datagram: record.body,
							ok: false,
							error: 'Failed to parse device info',
							ttl,
						}),
					}),
				)
				continue
			}

			if (maybeLwM2M === null || maybeLwM2M.length === 0) {
				console.debug(messageId, `Failed to parse record: ${record.body}`)
				await db.send(
					new PutItemCommand({
						TableName: udpDatagramsTableName,
						Item: marshall({
							deviceId: 'unknown',
							messageId,
							datagram: record.body,
							ok: false,
							error: 'Failed to parse payload',
							ttl,
						}),
					}),
				)
				continue
			}

			await db.send(
				new PutItemCommand({
					TableName: udpDatagramsTableName,
					Item: marshall({
						deviceId,
						messageId,
						datagram: record.body,
						ok: true,
						objects: maybeLwM2M,
						ttl,
					}),
				}),
			)

			await notifier({
				'@context': new URL('https://thingy.rocks/lwm2m-update'),
				deviceId,
				objects: maybeLwM2M,
			})

			await u(deviceId, maybeLwM2M)
		}
	})
