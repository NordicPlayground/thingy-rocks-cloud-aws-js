import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, it } from 'node:test'
import { processMessage } from './processMessage.ts'

const __dirname = new URL('./exampleMessages', import.meta.url).pathname

void describe('processMessage', () => {
	void it('should return LwM2M object from the shadow if shadow message', async () => {
		const shadowMessage = JSON.parse(
			await readFile(path.join(__dirname, 'exampleShadow.json'), 'utf-8'),
		)
		const processedMessage = processMessage({ message: shadowMessage })
		const expectedLwM2MObjects = [
			{
				ObjectID: 14503,
				ObjectVersion: '1.0',
				Resources: {
					'0': 1592461780,
					'1': 703710,
					'2': 'FT',
					'99': 1760514064,
				},
			},
			{
				ObjectID: 14502,
				ObjectVersion: '1.0',
				Resources: { '0': 696113427, '1': 0, '99': 1760524760 },
			},
		]
		assert.deepEqual(processedMessage, expectedLwM2MObjects)
	})
	void it('should return LwM2M location object if CoAP response', async () => {
		const locationMessage = JSON.parse(
			await readFile(
				path.join(__dirname, 'exampleLocationCoAPMessage.json'),
				'utf-8',
			),
		)
		const receivedAt = '2024-06-11T10:20:30Z'
		const processedMessage = processMessage({
			message: locationMessage,
			receivedAt,
			coapRequestUrl: 'FETCH /loc/ground-fix',
		})
		const expectedLwM2MObjects = [
			{
				ObjectID: 14201,
				ObjectVersion: '1.0',
				ObjectInstanceID: 1,
				Resources: {
					'0': 63.4317043,
					'1': 10.4711207,
					'3': 17.245,
					'6': 'WIFI',
					'99': Date.parse(receivedAt) / 1000,
				},
			},
		]
		assert.deepEqual(processedMessage, expectedLwM2MObjects)
	})
	void it('should return undefined if message is not known', async () => {
		const unknownMessage = { message: 'unknownMessage' }
		assert.equal(processMessage(unknownMessage), undefined)
	})
})
