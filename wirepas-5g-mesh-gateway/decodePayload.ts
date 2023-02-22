import type { Wirepas5GMeshNodePayload } from '../lambda/notifyClients'
import { ScannableArray } from './ScannableArray'

/**
 * @see https://github.com/wirepas/wm-sdk/tree/v1.4.0/source/example_apps/evaluation_app#button-pressed-notification-message
 */
export const decodePayload = (
	payload: Uint8Array,
): Wirepas5GMeshNodePayload | null => {
	const scannableMessage = new ScannableArray(payload)
	switch (scannableMessage.getChar()) {
		// Periodic message with a counter value
		case 0:
			scannableMessage.next()
			return counterMessage(scannableMessage)
		// Button pressed
		case 1:
			scannableMessage.next()
			return { button: scannableMessage.getChar() as number }
		// LED state
		case 3:
		case 129:
			scannableMessage.next()
			return {
				led: {
					[scannableMessage.getCharNext()]: scannableMessage.getCharNext(),
				},
			}
		default:
			console.error(`Unknown message type`, scannableMessage.getChar())
			return null
	}
}

const counterMessage = (message: ScannableArray): { counter: number } => {
	const counterBytes = Buffer.alloc(4)
	counterBytes.writeUInt8(message.getCharNext(), 0)
	counterBytes.writeUInt8(message.getCharNext(), 1)
	counterBytes.writeUInt8(message.getCharNext(), 2)
	counterBytes.writeUInt8(message.getCharNext(), 3)
	const counterValue = new Uint32Array(counterBytes)[0]
	return { counter: counterValue as number }
}
