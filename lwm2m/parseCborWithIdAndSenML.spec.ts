import assert from 'node:assert'
import { describe, it } from 'node:test'
import { parseCborWithIdAndSenML } from './parseCborWithIdAndSenML.ts'

void describe('parseCborWithIdAndSenML', () => {
	void it('should parse CBOR payloads correctly', () =>
		assert.deepEqual(
			parseCborWithIdAndSenML(
				Buffer.from(
					'826F3335343632393639303031333531398AA4622D326831343230342F302F6130613061336F333534363239363930303133353139622D331A69827D9EA261306132613371302E302E302D646576656C6F706D656E74A261306133613371302E302E302D646576656C6F706D656E74A26130613461336D6B657973696768745F64656D6FA4622D326831343230332F302F6130613061336132622D331A69827D9EA261306131613214A26130613261323853A2613061356133653234343132A4622D326831343230352F302F613061306132FB4038428F5C28F5C3622D331A69827D9EA2613061326132FB405967AE147AE148',
					'hex',
				).toString('base64'),
			),
			{
				deviceId: '354629690013519',
				lwm2m: [
					{
						ObjectID: 14204,
						Resources: {
							'0': '354629690013519',
							'2': '0.0.0-development',
							'3': '0.0.0-development',
							'4': 'keysight_demo',
							'99': 1770159518,
						},
					},
					{
						ObjectID: 14203,
						Resources: {
							'0': '2',
							'1': 20,
							'2': -84,
							'5': '24412',
							'99': 1770159518,
						},
					},
					{
						ObjectID: 14205,
						Resources: {
							'0': 24.26,
							'2': 101.62,
							'99': 1770159518,
						},
					},
				],
			},
		))
})
