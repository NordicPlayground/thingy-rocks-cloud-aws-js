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
import { updateShadow } from './updateShadow.ts'

export const iotData = new IoTDataPlaneClient({})

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

// 2. Application data
const appDataMessageSchema = Type.Object({
	messageType: Type.String(),
	appId: Type.String(),
	data: Type.Any(),
	ts: Type.Number(),
})

// 3. CoAP request/response
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
	appDataMessageSchema,
	coapMessageSchema,
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
	.use(
		validateInput(inputSchemaLwm2mMessage, (event) =>
			JSON.parse(event.body ?? '{}'),
		),
	)
	.handler(async (event, context): Promise<APIGatewayProxyResultV2> => {
		console.log('context:', context.validInput)
		if (event.requestContext.http.method === 'POST') {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const body = JSON.parse(event.body ?? '{}')
			for (const message of body.messages) {
				const { teamId, deviceId } = message
				const thingName = `${teamId}-${deviceId}`
				const lwm2m = message.message.current?.state?.reported?.lwm2m
				if (lwm2m !== undefined && Object.keys(lwm2m).length > 0) {
					console.log('Shadow LwM2M data:', lwm2m)
					const transformed = shadowToObjects(lwm2m)
					console.log('Transformed LwM2M:', transformed)
					await u(thingName, transformed)
					continue
				}

				// --- CASE 2: CoAP request/response ---
				if (
					message.message.response?.body !== undefined &&
					message.coapRequestUrl === 'FETCH /loc/ground-fix'
				) {
					try {
						const base64 = message.message.response.body
						const parsed = parseCbor(base64)
						const ts = Date.parse(message.receivedAt ?? '') || Date.now()
						const lwm2mObject = locationDataFromCOAPToLwm2m(parsed, ts)
						console.log('CoAP → LwM2M object:', lwm2mObject)
						await u(thingName, [lwm2mObject])
					} catch (err) {
						console.error('Failed to parse CoAP body:', err)
					}
					continue
				}

				// --- CASE 3: Application DATA messages ---
				if (message.message.messageType === 'DATA') {
					console.log('App data message:', message.message)
					// You could forward or transform these differently
					continue
				}

				// --- CASE 4: Fallback ---
				console.log('Unhandled message shape:', message)
			}
			return {
				statusCode: 200,
				body: JSON.stringify({ message: 'Received' }),
			}
		}

		return {
			statusCode: 405,
			body: 'Method Not Allowed',
		}
	})
