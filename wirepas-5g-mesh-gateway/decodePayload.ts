import { ScannableArray } from './ScannableArray.js'
export type Wirepas5GMeshNodePayload =
	| { counter: number }
	| { timestamp: number }
	| { temperature: number }
	| { button: number }
	| { humidity: number }
	| { raw_pressure: number }
	| { raw_gas: number }

enum MessageType {
	COUNTER = 0x01, //          [0x04]   [size_t counter]
	TIMESTAMP = 0x02, //        [0x08]   [int64_t timestamp]
	IAQ = 0x03, //              [0x02]   [uint16_t iaq]
	IAQ_ACC = 0x04, //          [0x01]   [uint8_t iaq_acc]
	SIAQ = 0x05, //             [0x02]   [uint16_t siaq]
	SIAQ_ACC = 0x06, //         [0x01]   [uint8_t siaq_acc]
	SENSOR_STATUS = 0x07, //    [0x01]   [uint8_t sensor_status]
	SENSOR_STABILITY = 0x08, // [0x01]   [uint8_t sensor_stable]
	GAS = 0x09, //              [0x01]   [uint8_t gas]
	GAS_ACC = 0x0a, //          [0x01]   [uint8_t gas_acc]
	VOC = 0x0b, //              [0x02]   [uint16_t voc]
	VOC_ACC = 0x0c, //          [0x01]   [uint8_t voc_acc]
	CO2 = 0x0d, //              [0x02]   [uint16_t co2]
	CO2_ACC = 0x0e, //          [0x01]   [uint8_t co2_acc]
	TEMPERATURE = 0x0f, //      [0x04]   [float temperature]
	HUMIDITY = 0x10, //         [0x04]   [float humidity]
	TEMP_RAW = 0x11, //         [0x04]   [float raw_temperature]
	HUM_RAW = 0x12, //          [0x04]   [float raw_humidity]
	PRESS_RAW = 0x13, //        [0x04]   [float raw_pressure]
	GAS_RAW = 0x14, //          [0x04]   [float raw_gas]
}

export const decodePayload = (
	payload: Uint8Array,
): Wirepas5GMeshNodePayload[] => {
	const messages: Wirepas5GMeshNodePayload[] = []
	const msg = new ScannableArray(payload)

	while (msg.hasNext()) {
		const type = msg.getChar()
		const len = msg.getChar()
		const skip = () => {
			for (let i = 0; i < len; i++) msg.getChar()
		}
		switch (type) {
			// Periodic message with a counter value
			case MessageType.COUNTER:
				messages.push({ counter: readUint(msg, len) })
				continue
			case MessageType.TIMESTAMP:
				// messages.push({ timestamp: readUint(msg, len) })
				skip()
				continue
			// Skip
			case MessageType.IAQ:
			case MessageType.IAQ_ACC:
			case MessageType.SIAQ:
			case MessageType.SIAQ_ACC:
			case MessageType.SENSOR_STATUS:
			case MessageType.SENSOR_STABILITY:
			case MessageType.GAS:
			case MessageType.GAS_ACC:
			case MessageType.VOC:
			case MessageType.VOC_ACC:
			case MessageType.CO2:
			case MessageType.CO2_ACC:
			case MessageType.TEMP_RAW:
			case MessageType.HUM_RAW:
				skip()
				continue
			case MessageType.TEMPERATURE:
				messages.push({ temperature: readFloat(msg, len) })
				continue
			case MessageType.HUMIDITY:
				messages.push({ humidity: readFloat(msg, len) })
				continue
			case MessageType.PRESS_RAW:
				messages.push({ raw_pressure: readFloat(msg, len) })
				continue
			case MessageType.GAS_RAW:
				messages.push({ raw_gas: readFloat(msg, len) })
				continue
			default:
				console.error(`Unknown message type`, type)
				skip()
				break
		}
	}

	return messages
}

const readUint = (message: ScannableArray, numBytes: number): number => {
	const bytes = Buffer.alloc(numBytes)
	for (let i = 0; i < numBytes; i++) {
		bytes.writeUInt8(message.getChar(), i)
	}
	return bytesToNumber(bytes)
}

const bytesToNumber = (byteArray: Buffer): number => {
	let result = 0
	for (let i = byteArray.byteLength - 1; i >= 0; i--) {
		result = result * 256 + (byteArray[i] ?? 0)
	}

	return result
}

const readFloat = (message: ScannableArray, numBytes: number): number => {
	const bytes = Buffer.alloc(numBytes)
	for (let i = 0; i < numBytes; i++) {
		bytes.writeUInt8(message.getChar(), i)
	}
	return bytesToFloat(bytes)
}

const bytesToFloat = (byteArray: Buffer): number => {
	const dataView = new DataView(byteArray.buffer)
	const floatValue = dataView.getFloat32(0, true)
	return floatValue
}
