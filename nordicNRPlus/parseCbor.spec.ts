import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseCBORLocationData } from './parseCbor.ts'

void describe('parseCbor', () => {
	void it('should parse CBOR data correctly', () => {
		const cborData = 'vwH7QE+3Qgs9SuQC+0Ak8SslR7glAxQEZFdJRkn/'
		const result = parseCBORLocationData(cborData)
		assert.deepEqual(result, {
			lat: 63.431703,
			lon: 10.4710323,
			uncertainty: 20,
			src: 'WIFI',
		})
	})
})
