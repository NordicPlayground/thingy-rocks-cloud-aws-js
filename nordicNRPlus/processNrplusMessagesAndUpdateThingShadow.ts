import { Type, type Static } from '@sinclair/typebox'
import { processMessage } from './processMessage.ts'

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

export const processNrplusMessagesAndUpdateThingShadow =
	({
		ensureThing,
		updateShadow,
		log,
	}: {
		ensureThing: (thingName: string) => Promise<void>
		updateShadow: (thingName: string, message: any) => Promise<void>
		log?: typeof console.log
	}) =>
	async (
		validatedInput: Static<typeof inputSchemaLwm2mMessage>,
	): Promise<void> => {
		const ensuredThings = new Map<string, Promise<void>>()
		for (const message of validatedInput.messages) {
			const { teamId, deviceId } = message
			const thingName = `${teamId}-${deviceId}`
			let ensurePromise = ensuredThings.get(thingName)
			if (!ensurePromise) {
				ensurePromise = ensureThing(thingName).catch((error) => {
					// If it fails, remove it from cache to allow retries
					ensuredThings.delete(thingName)
					throw new Error(
						`Failed to ensure thing exists: ${thingName} with the error: ${(error as Error).message}`,
					)
				})
				ensuredThings.set(thingName, ensurePromise)
			}
			await ensurePromise

			const maybeProcessedMessage = processMessage(message)
			if (maybeProcessedMessage === undefined) {
				log?.('Unhandled message:', message)
				continue
			}
			await updateShadow(thingName, maybeProcessedMessage)
			log?.(
				'Updated shadow for',
				thingName,
				'with the message',
				JSON.stringify(maybeProcessedMessage),
			)
		}
	}
