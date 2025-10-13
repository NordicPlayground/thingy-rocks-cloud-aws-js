import { IoTClient } from '@aws-sdk/client-iot'
import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane'
import { validateInput } from '@hello.nrfcloud.com/lambda-helpers/validateInput'
import middy from '@middy/core'
import inputOutputLogger from '@middy/input-output-logger'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { ensureThingExists } from './ensureThingExists.ts'
import { processMessage } from './processMessage.ts'
import { updateShadow } from './updateShadow.ts'

export const iotData = new IoTDataPlaneClient({})
const iotClient = new IoTClient({})

const u = updateShadow(iotData)

const neighborsInputSchema = Type.Object({
	0: Type.Number(),
	1: Type.Number(),
	99: Type.Number(),
})
const neighborsObjectSchema = Type.Record(Type.String(), neighborsInputSchema)

const networkInputSchema = Type.Object({
	0: Type.Number(),
	1: Type.Number(),
	2: Type.String(),
	99: Type.Number(),
})
const networkObjectSchema = Type.Record(Type.String(), networkInputSchema)

const buttonPressInputSchema = Type.Object({
	99: Type.Number(),
})
const buttonPressObjectSchema = Type.Record(
	Type.String(),
	buttonPressInputSchema,
)

const lwm2mSchema = Type.Object({
	'14502:1.0': Type.Optional(neighborsObjectSchema),
	'14503:1.0': Type.Optional(networkObjectSchema),
	'14220:1.0': Type.Optional(buttonPressObjectSchema),
})

const shadowMessageSchema = Type.Object({
	previous: Type.Optional(
		Type.Object({
			state: Type.Object({
				desired: Type.Optional(Type.Any()),
				reported: Type.Optional(
					Type.Object({ lwm2m: Type.Optional(lwm2mSchema) }),
				),
			}),
		}),
	),
	current: Type.Optional(
		Type.Object({
			state: Type.Object({
				desired: Type.Optional(Type.Any()),
				reported: Type.Optional(
					Type.Object({ lwm2m: Type.Optional(lwm2mSchema) }),
				),
			}),
		}),
	),
})

const coapMessageSchema = Type.Object({
	request: Type.Object({
		body: Type.String(), // base64
	}),
	response: Type.Optional(
		Type.Object({
			body: Type.Optional(Type.String()),
		}),
	),
})

const messageSchema = Type.Union([
	shadowMessageSchema,
	coapMessageSchema,
	Type.Any(),
])

export const inputSchemaLwm2mMessage = Type.Object({
	type: Type.Literal('device.messages'),
	messages: Type.Array(
		Type.Object({
			teamId: Type.String(),
			deviceId: Type.String(),
			messageId: Type.String(),
			topic: Type.Optional(Type.String()),
			coapRequestUrl: Type.Optional(Type.String()),
			receivedAt: Type.Optional(Type.String()),
			message: messageSchema,
		}),
	),
	timestamp: Type.String(),
})

const ensureThing = ensureThingExists(iotClient)

export const handler = middy<APIGatewayProxyEventV2, APIGatewayProxyResultV2>()
	.use(inputOutputLogger())
	.use(validateInput(inputSchemaLwm2mMessage))
	.handler(async (event, context): Promise<APIGatewayProxyResultV2> => {
		if (event.requestContext.http.method !== 'POST') {
			return {
				statusCode: 405,
				body: 'Method Not Allowed',
			}
		}
		const validatedInput = context.decodedInput
		for (const message of validatedInput.messages) {
			const { teamId, deviceId } = message
			const thingName = `${teamId}-${deviceId}`
			try {
				await ensureThing(thingName)
			} catch (error) {
				throw new Error(
					`Failed to ensure thing exists: ${thingName} with the error: ${(error as Error).message}`,
				)
			}
			const maybeProcessedMessage = processMessage(message)
			if (maybeProcessedMessage === undefined) {
				console.log('Unhandled message:', message)
				continue
			}
			await u(thingName, maybeProcessedMessage)
			console.log(
				'Updated shadow for',
				thingName,
				'with the message',
				JSON.stringify(maybeProcessedMessage),
			)
		}
		return {
			statusCode: 200,
		}
	})
