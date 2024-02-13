import { describe, it } from 'node:test'
import { decodePayload } from './decodePayload.js'
import assert from 'node:assert/strict'

void describe('decodePayload()', () => {
	void it('should decode a regular payload', () => {
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

		assert.deepEqual(decoded, {
			// eslint-disable-next-line @typescript-eslint/no-loss-of-precision
			temp: 24.479999542236328,
		})
	})

	void it('should decode a button press', () => {
		const now = Date.now()
		assert.deepEqual(
			decodePayload(Buffer.from('010002', 'hex'), undefined, () => now),
			{
				btn: {
					v: 2,
					ts: now,
				},
			},
		)
	})

	void it('should decode a LED state change', () =>
		assert.deepEqual(decodePayload(Buffer.from('030101', 'hex')), {
			led: { b: true },
		}))

	void it('should ignore messages starting with bf', () =>
		assert.deepEqual(
			decodePayload(
				Buffer.from(
					'bf1840820118191845890119c31c000019022918fa190a9e0000184186011a0a175ab41a0a175ab418ff00001842820000182e8218ff0018180001140502040607030818ff181a01181b011830011831241201ff',
					'hex',
				),
			),
			{},
		))

	void it('should ignore LED status read messages', () =>
		assert.deepEqual(decodePayload(Buffer.from('8201', 'hex')), {}))
})
