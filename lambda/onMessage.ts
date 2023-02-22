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
import { getLedState, turnOnLed, wirepasPublish } from './wirepasPublish.js'
const { TableName } = fromEnv({ TableName: 'CONNECTIONS_TABLE_NAME' })(
	process.env,
)

const db = new DynamoDBClient({})
const iot = new IoTClient({})
const iotData = new IoTDataPlaneClient({})

const { connectionsTableName, websocketManagementAPIURL, gatewayMqttEndpoint } =
	fromEnv({
		connectionsTableName: 'CONNECTIONS_TABLE_NAME',
		websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
		gatewayMqttEndpoint: 'GATEWAY_MQTT_ENDPOINT',
	})(process.env)

export const apiGwManagementClient = new ApiGatewayManagementApi({
	endpoint: websocketManagementAPIURL,
})
const notifier = notifyClients({
	db,
	connectionsTableName,
	apiGwManagementClient,
})

const publishToMesh = wirepasPublish({
	gatewayMqttEndpoint,
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
				if (res.attributes?.code === code) {
					const deviceAlias = res.attributes.name
					switch (res.thingTypeName) {
						case 'rgb-light':
							await iotData.send(
								new PublishCommand({
									topic: `${deviceId}/light-bulb/led-ctrl`,
									payload: new TextEncoder().encode(ledColor.join(',')),
								}),
							)
							await notifier({
								deviceId,
								deviceAlias,
								lightbulb: {
									type: 'rgb',
									color: ledColor,
								},
							})
							break
						case 'mesh-node':
							await (async () => {
								const node = parseInt(deviceId.split(':')[0] ?? '0', 10)
								const gateway = deviceId.split(':')[1] ?? ''
								await publishToMesh({
									gateway,
									req: turnOnLed({ node, ledState: isOn(ledColor) }),
								})
								await notifier({
									deviceId,
									deviceAlias,
									meshNodeEvent: {
										message: {
											led: { [0]: isOn(ledColor) ? 1 : 0 },
										},
										meta: {
											node,
											gateway,
											rxTime: new Date(),
											travelTimeMs: 0,
										},
									},
								})
								// Wait two seconds before querying the LED state
								await new Promise((resolve) => setTimeout(resolve, 2 * 1000))
								await publishToMesh({ gateway, req: getLedState({ node }) })
							})()
							break
						default:
							console.error(`Thing has unsupported type`, res.thingTypeName)
					}
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

const isOn = (rgb: [number, number, number]): boolean =>
	rgb.reduce((sum, c) => sum + c, 0) > 0
