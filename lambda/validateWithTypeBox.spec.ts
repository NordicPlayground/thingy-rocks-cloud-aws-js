import { Type } from '@sinclair/typebox'
import { validateWithTypeBox } from './validateWithTypeBox'

describe('validateWithTypeBox', () => {
	it('Should check input is valid', async () => {
		const maybeValid = validateWithTypeBox(Type.Number())(42)
		if ('value' in maybeValid) {
			expect(maybeValid.value).toEqual(42)
		} else {
			throw new Error(`It should be valid!`)
		}
	})
	it("Should check as 'invalid' values less than 0", (done) => {
		const maybeValid = validateWithTypeBox(Type.Number({ minimum: 0 }))(-42)
		if ('errors' in maybeValid) {
			done()
		} else {
			throw new Error(`It should not be valid!`)
		}
	})
})
