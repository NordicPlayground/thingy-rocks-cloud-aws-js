import { Type } from '@sinclair/typebox'
import { validateWithTypeBox } from './validateWithTypeBox.js'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

void describe('validateWithTypeBox', () => {
	void it('Should check input is valid', async () => {
		const maybeValid = validateWithTypeBox(Type.Number())(42)
		assert.equal(
			'value' in maybeValid && maybeValid.value,
			42,
			`It should be valid!`,
		)
	})
	void it("Should check as 'invalid' values less than 0", () => {
		const maybeValid = validateWithTypeBox(Type.Number({ minimum: 0 }))(-42)
		assert.equal('errors' in maybeValid, true, `It should not be valid!`)
	})
})
