import { CreateThingCommand, IoTClient } from '@aws-sdk/client-iot'
import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane'
import { validateInput } from '@hello.nrfcloud.com/lambda-helpers/validateInput'
import { shadowToObjects } from '@hello.nrfcloud.com/proto-map/lwm2m/aws'
import middy from '@middy/core'
import inputOutputLogger from '@middy/input-output-logger'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { locationDataFromCOAPToLwm2m } from '../nordicNRPlus/locationDataFromCOAPToLwm2m.ts'
import { parseCbor } from '../nordicNRPlus/parseCbor.ts'
import { thingExists } from '../nordicNRPlus/thingExists.ts'
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

// 2. CoAP request/response
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
			//check if thing exists, if not create it
			if ((await thingExists(iotClient, thingName)) === false) {
				try {
					await iotClient.send(
						new CreateThingCommand({
							thingName,
							thingTypeName: 'nordic-nrplus',
						}),
					)
				} catch (error) {
					console.error('Error creating thing:', error)
					continue
				}
			}
			// --- CASE 1: Shadow update ---
			const lwm2m = message.message.current?.state?.reported?.lwm2m
			if (lwm2m !== undefined && Object.keys(lwm2m).length > 0) {
				const transformed = shadowToObjects(lwm2m)
				console.log('LwM2M update to shadow:', transformed)
				await u(thingName, transformed)
				continue
			}

			// --- CASE 2: CoAP request/response ---
			if (
				message.message.response?.body !== undefined &&
				message.coapRequestUrl === 'FETCH /loc/ground-fix'
			) {
				const base64 = message.message.response.body
				const parsed = parseCbor(base64)
				const ts = Date.parse(message.receivedAt ?? '') || Date.now()
				const lwm2mObject = locationDataFromCOAPToLwm2m(parsed, ts)
				console.log('CoAP location LwM2M object to shadow:', lwm2mObject)
				await u(thingName, [lwm2mObject])
				continue
			}

			// --- CASE 3: Fallback ---
			console.log('Unhandled message shape:', message)
		}
		return {
			statusCode: 200,
		}
	})
