import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { DescribeThingCommand, IoTClient } from '@aws-sdk/client-iot'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyStructuredResultV2,
	APIGatewayProxyWebsocketEventV2,
} from 'aws-lambda'
import { fetchLwM2MShadows } from '../lwm2m/fetchLwM2MShadows.ts'
import { sendEvent } from './notifyClients.ts'
import { validateWithTypeBox } from './validateWithTypeBox.ts'

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
	data: deviceControl,
})
const validateMessage = validateWithTypeBox(message)

const iot = new IoTClient({})
const db = new DynamoDBClient({})

const apiGwManagementClient = new ApiGatewayManagementApi({
	endpoint: websocketManagementAPIURL,
})

const send = sendEvent(apiGwManagementClient)

const fetchLwM2M = fetchLwM2MShadows(iot)

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
		const shadows = await fetchLwM2M(1)

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
		return {
			statusCode: 202,
		}
	}
}
