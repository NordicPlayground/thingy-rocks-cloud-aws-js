import { describe, it } from 'node:test'
import { decodePayload } from './decodePayload.js'
import assert from 'node:assert/strict'

void describe('decodePayload()', () => {
	void it('should decode the payload', () => {
		/*

        For this payload (92 bytes), it is on TLV format: you have the information ID (1 byte), the data length (1 byte) and the data (n bytes).

        For example, data 01 corresponds to the counter (4 bytes long, data is 42 c2 00 00 or 49730).

        The relevant data starts with 0F for the temperature (here, it is this part: 0f 04 0a d7 c3 41, which gives a temperature of 24.48°C (it is a float32)).

        Also, we send data starting with 01 but with a different length (3 bytes) which corresponds to a key press.
        Example: 01 00 02 (because there is only one button).

        You may see payloads starting with 03 (3 bytes): it is when LED status/color changes.
        In this case, color is the following:
            
        Byte 1: ID (0x03)
        Byte 2: Color. 0x00: red, 0x01: blue, 0x02: green
        Byte 3: State. 0x00: off, 0x01: on.
        We send this payload when requested (response to get LED status (starts with 0x82)) or when setting LED (message 0x81), as an acknowledgement (to confirm color/status has changed).
            
        */
		const payload = Buffer.from(
			[
				// [0x01: COUNTER]         [0x04]   [size_t counter]
				'01 04 42 c2 00 00',
				// [0x02: TIMESTAMP]       [0x08]   [int64_t timestamp]
				'02 08 48 db f5 60 9b e4 00 00',
				// [0x03: IAQ]             [0x02]   [uint16_t iaq]
				'03 02 00 00',
				// [0x04: IAQ_ACC]         [0x01]   [uint8_t iaq_acc]
				'04 01 00',
				// [0x05: SIAQ]            [0x02]   [uint16_t siaq]
				'05 02 00 00',
				// [0x06: SIAQ_ACC]        [0x01]   [uint8_t siaq_acc]
				'06 01 00',
				// [0x07: SENSOR_STATUS]   [0x01]   [uint8_t sensor_status]
				'07 01 00',
				// [0x08: SENSOR_STABILITY][0x01]   [uint8_t sensor_stable]
				'08 01 00',
				// [0x09: GAS]             [0x01]   [uint8_t gas]
				'09 01 00',
				// [0x0A: GAS_ACC]         [0x01]   [uint8_t gas_acc]
				'0a 01 00',
				// [0x0B: VOC]             [0x02]   [uint16_t voc]
				'0b 02 00 00',
				// [0x0C: VOC_ACC]         [0x01]   [uint8_t voc_acc]
				'0c 01 00',
				// [0x0D: CO2]             [0x02]   [uint16_t co2]
				'0d 02 00 00',
				// [0x0E: CO2_ACC]         [0x01]   [uint8_t co2_acc]
				'0e 01 00',
				// [0x0F: TEMPERATURE]     [0x04]   [float temperature]
				'0f 04 0a d7 c3 41',
				// [0x10: HUMIDITY]        [0x04]   [float humidity]
				'10 04 68 91 8d 41',
				// [0x12: HUM_RAW]         [0x04]   [float raw_humidity]
				'12 04 00 40 8a 46',
				// [0x11: TEMP_RAW]        [0x04]   [float raw_temperature]
				'11 04 00 00 19 45',
				// [0x13: PRESS_RAW]       [0x04]   [float raw_pressure]
				'13 04 80 f2 c3 47',
				// [0x14: GAS_RAW]         [0x04]   [float raw_gas]
				'14 04 00 ca 9e 47',
			]
				.join('')
				.replaceAll(' ', ''),
			'hex',
		)

		const decoded = decodePayload(payload)

		assert.deepEqual(decoded, [
			{ counter: 49730 },
			{
				// eslint-disable-next-line @typescript-eslint/no-loss-of-precision
				temperature: 24.479999542236328,
			},
			{
				// eslint-disable-next-line @typescript-eslint/no-loss-of-precision
				humidity: 17.695999145507812,
			},
			{
				raw_pressure: 100325,
			},
			{
				raw_gas: 81300,
			},
		])
	})
})
