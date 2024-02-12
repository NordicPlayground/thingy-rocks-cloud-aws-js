import { ScannableArray } from './ScannableArray.js'
export type Wirepas5GMeshNodePayload = {
	temp?: number
	btn?: number
	led?: {
		r?: boolean
		g?: boolean
		b?: boolean
	}
}

enum MessageType {
	COUNTER = 0x01, //          [0x04]   [size_t counter]
	// Uptime in nanoseconds, e.g. 251355997789000 / 1000 / 1000 / 1000 / 60 / 60 / 24 = 2.909 days
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

enum LED_COLOR {
	RED = 0,
	BLUE = 1,
	GREEN = 2,
}

/*

For this payload (92 bytes), it is on TLV format: you have the information ID (1 byte), the data length (1 byte) and the data (n bytes).

For example, data 01 corresponds to the counter (4 bytes long, data is 42 c2 00 00 or 49730).

The relevant data starts with 0F for the temperature (here, it is this part: 0f 04 0a d7 c3 41, which gives a temperature of 24.48°C (it is a float32)).

## Button special case

Also, we send data starting with 01 but with a different length (3 bytes) which corresponds to a key press.

Example: 01 00 02 (because there is only one button).

## LED special case

You may see payloads starting with 03 (3 bytes): it is when LED status/color changes.
In this case, color is the following:
	
Byte 1: ID (0x03)
Byte 2: Color. 0x00: red, 0x01: blue, 0x02: green
Byte 3: State. 0x00: off, 0x01: on.

## Diagnostic messages

Concerning the message starting with BF, it does not come from the Thingy: these are diagnostic messages giving information about the network. You can safely ignore them too.

*/
export const decodePayload = (
	payload: Uint8Array,
	onUnknown?: (type: number, pos: number) => void,
): Wirepas5GMeshNodePayload => {
	const msg = new ScannableArray(payload)

	let message: Wirepas5GMeshNodePayload = {}

	// Diagnostic special case
	if (msg.peek() === parseInt('BF', 16)) {
		return {}
	}

	// Button special case
	if (payload.length === 3 && msg.peek() === 1) {
		msg.next() // skip type
		msg.next() // skip len
		return { btn: readUint(msg, 1) }
	}

	// LED special case
	if (payload.length === 3 && msg.peek() === 3) {
		msg.next() // skip type
		const color = readUint(msg, 1)
		const state = readUint(msg, 1)
		switch (color) {
			case LED_COLOR.BLUE:
				return {
					led: {
						b: state === 1 ? true : false,
					},
				}
			case LED_COLOR.GREEN:
				return {
					led: {
						g: state === 1 ? true : false,
					},
				}
			default:
				return {
					led: {
						r: state === 1 ? true : false,
					},
				}
		}
	}

	// Regular message
	while (msg.hasNext()) {
		const type = msg.getChar()
		const len = msg.getChar()
		const skip = () => {
			for (let i = 0; i < len; i++) msg.getChar()
		}
		switch (type) {
			// Skip
			case MessageType.COUNTER:
			case MessageType.TIMESTAMP:
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
			case MessageType.HUMIDITY:
			case MessageType.PRESS_RAW:
			case MessageType.GAS_RAW:
				skip()
				continue
			case MessageType.TEMPERATURE:
				message = { ...message, temp: readFloat(msg, len) }
				continue
			default:
				onUnknown?.(type, msg.pos() - 1)
				skip()
				break
		}
	}

	return message
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
