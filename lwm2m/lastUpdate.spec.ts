import assert from 'node:assert'
import { describe, it } from 'node:test'
import { lastUpdate } from './lastUpdate.ts'

void describe('lastUpdate()', () => {
	void it('should find the last update timestamp', () =>
		assert.equal(
			lastUpdate({
				welcome: { timestamp: 1758697497 },
				'14503:1.0': {
					'0': {
						'0': { timestamp: 1758870190 },
						'1': { timestamp: 1758870190 },
						'2': { timestamp: 1758870190 },
						'99': { timestamp: 1758870190 },
					},
				},
				'14502:1.0': {
					'0': {
						'0': { timestamp: 1758870190 },
						'1': { timestamp: 1758870190 },
						'99': { timestamp: 1758870190 },
					},
				},
				'14201:1.0': {
					'1': {
						'0': { timestamp: 1758870192 },
						'1': { timestamp: 1758870192 },
						'3': { timestamp: 1758870192 },
						'6': { timestamp: 1758870192 },
						'99': { timestamp: 1758870192 },
					},
				},
			}),
			1758870192,
		))
})
