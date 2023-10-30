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
import { DescribeThingCommand, IoTClient } from '@aws-sdk/client-iot'

const db = new DynamoDBClient({})

const { TableName } = fromEnv({
	TableName: 'CONNECTIONS_TABLE_NAME',
})(process.env)

const message = Type.Object({
	message: Type.Literal('sendmessage'),
	data: Type.Object({
		deviceId: Type.String({ minLength: 1 }),
		code: Type.String({ minLength: 1 }),
		nrplusCtrl: Type.String({ minLength: 1 }),
	}),
})
const validateMessage = validateWithTypeBox(message)

const iotData = new IoTDataPlaneClient({})
const iot = new IoTClient({})

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

	const maybeValidMessage = validateMessage(message)
	if ('errors' in maybeValidMessage) {
		console.error(
			`Failed to validate message: ${JSON.stringify(maybeValidMessage.errors)}`,
		)
		return {
			statusCode: 400,
		}
	} else {
		const { deviceId, code, nrplusCtrl } = maybeValidMessage.value.data
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
		await iotData.send(
			new PublishCommand({
				topic: `${deviceId}/nrplus-ctrl`,
				payload: Buffer.from(nrplusCtrl, 'hex'),
				qos: 1,
			}),
		)
		console.log(`>`, `${deviceId}/nrplus-ctrl`, nrplusCtrl)
		return {
			statusCode: 202,
		}
	}
}
