import type { Static } from '@sinclair/typebox'
import type { inputSchemaLwm2mMessage } from '../lambda/webhookHandler.ts'
import { processMessage } from './processMessage.ts'

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
