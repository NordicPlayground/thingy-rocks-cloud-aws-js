import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { DescribeThingCommand, IoTClient } from '@aws-sdk/client-iot'
import {
	IoTDataPlaneClient,
	PublishCommand,
} from '@aws-sdk/client-iot-data-plane'
import { fromEnv } from '@nordicsemiconductor/from-env'
import type {
	APIGatewayProxyStructuredResultV2,
	APIGatewayProxyWebsocketEventV2,
} from 'aws-lambda'
import { notifyClients } from './notifyClients.js'
const { TableName } = fromEnv({ TableName: 'CONNECTIONS_TABLE_NAME' })(
	process.env,
)

const db = new DynamoDBClient({})
const iot = new IoTClient({})
const iotData = new IoTDataPlaneClient({})

const { connectionsTableName, websocketManagementAPIURL } = fromEnv({
	connectionsTableName: 'CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
})(process.env)

export const apiGwManagementClient = new ApiGatewayManagementApi({
	endpoint: websocketManagementAPIURL,
})
const notifier = notifyClients({
	db,
	connectionsTableName,
	apiGwManagementClient,
})

export const handler = async (
	event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
	console.log(
		JSON.stringify({
			event,
		}),
	)

	await db.send(
		new UpdateItemCommand({
			TableName,
			Key: {
				connectionId: {
					S: event.requestContext.connectionId,
				},
			},
			UpdateExpression: 'SET #lastSeen = :lastSeen',
			ExpressionAttributeNames: {
				'#lastSeen': 'lastSeen',
			},
			ExpressionAttributeValues: {
				':lastSeen': {
					S: new Date().toISOString(),
				},
			},
		}),
	)

	if (event.body !== undefined) {
		try {
			const message = JSON.parse(event.body) as {
				data?: {
					desired?: {
						led?: {
							v: {
								color: [number, number, number]
							}
						}
					}
					deviceId?: string
					code?: string
				}
			}

			const ledColor = message?.data?.desired?.led?.v.color
			const deviceId = message?.data?.deviceId
			const code = message?.data?.code
			if (
				ledColor !== undefined &&
				deviceId !== undefined &&
				code !== undefined
			) {
				const res = await iot.send(
					new DescribeThingCommand({
						thingName: deviceId,
					}),
				)
				if (
					res.attributes?.code === code &&
					res.thingTypeName === 'rgb-light'
				) {
					await iotData.send(
						new PublishCommand({
							topic: `${deviceId}/light-bulb/led-ctrl`,
							payload: new TextEncoder().encode(ledColor.join(',')),
						}),
					)

					await notifier({
						deviceId,
						deviceAlias: res.attributes.name,
						lightbulb: {
							type: 'rgb',
							color: ledColor,
						},
					})
				}
			}
		} catch (err) {
			console.error(err)
		}
	}

	return {
		statusCode: 200,
		body: `Got your message, ${event.requestContext.connectionId}!`,
	}
}
