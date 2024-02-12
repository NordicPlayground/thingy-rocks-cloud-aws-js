import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyStructuredResultV2,
	APIGatewayProxyWebsocketEventV2,
} from 'aws-lambda'
import { validateWithTypeBox } from './validateWithTypeBox.js'
import {
	IoTDataPlaneClient,
	PublishCommand,
} from '@aws-sdk/client-iot-data-plane'
import {
	DescribeThingCommand,
	IoTClient,
	SearchIndexCommand,
} from '@aws-sdk/client-iot'
import {
	UpdateThingShadowCommand,
	type UpdateThingShadowCommandInput,
} from '@aws-sdk/client-iot-data-plane'
import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { sendEvent } from './notifyClients.js'
import type { LwM2MObjectInstance } from '@hello.nrfcloud.com/proto-lwm2m'
import { shadowToObjects } from '../lwm2m/shadowToObjects.js'
import { getDeviceInfo } from './withDeviceAlias.js'

const { TableName, websocketManagementAPIURL } = fromEnv({
	TableName: 'CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
})(process.env)

const deviceControl = Type.Object({
	deviceId: Type.String({ minLength: 1 }),
	code: Type.String({ minLength: 1 }),
})

const message = Type.Object({
	message: Type.Literal('sendmessage'),
	data: Type.Union([
		Type.Intersect([
			deviceControl,
			Type.Object({
				nrplusCtrl: Type.String({ minLength: 1 }),
			}),
		]),
		Type.Intersect([
			deviceControl,
			Type.Object({
				wirepasCtrl: Type.Object({
					nodes: Type.Record(
						Type.String({ minLength: 1 }),
						Type.Object({
							payload: Type.Object({
								led: Type.Object({
									r: Type.Boolean(),
									g: Type.Boolean(),
									b: Type.Boolean(),
								}),
							}),
						}),
					),
				}),
			}),
		]),
	]),
})
const validateMessage = validateWithTypeBox(message)

const iotData = new IoTDataPlaneClient({})
const iot = new IoTClient({})
const db = new DynamoDBClient({})

const apiGwManagementClient = new ApiGatewayManagementApi({
	endpoint: websocketManagementAPIURL,
})

const send = sendEvent(apiGwManagementClient)

const deviceInfo = getDeviceInfo(iot)

export const handler = async (
	event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
	console.log(
		JSON.stringify({
			event,
		}),
	)

	let message: Record<string, any> | undefined = undefined
	try {
		message = JSON.parse(event.body ?? '{}')
	} catch (err) {
		console.error(`Failed to parse message as JSON.`)
	}

	if (message === undefined) {
		console.error(`No message provided.`)
		return {
			statusCode: 400,
		}
	}
	if (message.data === 'PING') {
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

		return {
			statusCode: 200,
		}
	}

	if (message.data === 'LWM2M-shadows') {
		// Publish LwM2M shadows
		const { things } = await iot.send(
			new SearchIndexCommand({
				// Find all things which have an LwM2M shadow
				queryString: 'shadow.name.lwm2m.hasDelta:*',
			}),
		)
		const shadows = (
			await Promise.all<{
				deviceId: string
				alias?: string
				objects: LwM2MObjectInstance[]
			}>(
				(things ?? []).map(async ({ thingName, shadow }) => {
					const alias = (await deviceInfo(thingName as string)).alias
					const reported = JSON.parse(shadow ?? '{}').name.lwm2m.reported
					if (reported === undefined)
						return {
							deviceId: thingName as string,
							alias,
							objects: [],
						}

					try {
						return {
							deviceId: thingName as string,
							alias,
							objects: shadowToObjects(reported),
						}
					} catch (err) {
						console.error(`Failed to convert shadow for thing ${thingName}`)
						console.log(
							JSON.stringify({
								thingName,
								shadow: {
									reported,
								},
							}),
						)
						console.error(err)
						return {
							deviceId: thingName as string,
							alias,
							objects: [],
						}
					}
				}),
			)
		).filter(({ objects }) => objects.length > 0)

		console.log(
			JSON.stringify({
				lwm2mShadows: shadows,
			}),
		)

		await send(
			event.requestContext.connectionId,
			{ shadows },
			new URL('https://thingy.rocks/lwm2m-shadows'),
		).catch(console.error)
	}

	const maybeValidMessage = validateMessage(message)
	if ('errors' in maybeValidMessage) {
		console.error(
			`Failed to validate message: ${JSON.stringify(maybeValidMessage.errors)}`,
		)
		return {
			statusCode: 400,
		}
	} else {
		const msg = maybeValidMessage.value.data
		const { deviceId, code } = msg
		const attributes = (
			await iot.send(new DescribeThingCommand({ thingName: deviceId }))
		).attributes
		if (
			attributes === undefined ||
			!('code' in attributes) ||
			attributes.code !== code
		) {
			return {
				statusCode: 403,
				body: `Code ${code} not valid for device ${deviceId}!`,
			}
		}
		if ('nrplusCtrl' in msg) {
			await iotData.send(
				new PublishCommand({
					topic: `${deviceId}/nrplus-ctrl`,
					payload: Buffer.from(msg.nrplusCtrl, 'utf-8'),
					qos: 1,
				}),
			)
			console.log(`>`, `${deviceId}/nrplus-ctrl`, msg.nrplusCtrl)
		}
		if ('wirepasCtrl' in msg) {
			const update: UpdateThingShadowCommandInput = {
				thingName: deviceId,
				payload: JSON.stringify({
					state: {
						desired: msg.wirepasCtrl,
					},
				}),
			}
			await iotData.send(new UpdateThingShadowCommand(update))
			console.log(JSON.stringify({ update }))
		}
		return {
			statusCode: 202,
		}
	}
}
