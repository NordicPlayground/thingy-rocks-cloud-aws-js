import type { Static, TSchema } from '@sinclair/typebox'
import ajvLib, { type ErrorObject } from 'ajv'
const Ajv = ajvLib.default
export const validateWithTypeBox = <T extends TSchema>(
	schema: T,
): ((value: unknown) =>
	| { value: Static<typeof schema> }
	| {
			errors: ErrorObject[]
	  }) => {
	const ajv = new Ajv()
	const v = ajv.compile(schema)
	return (value: unknown) => {
		const valid = v(value)
		if (valid !== true) {
			return {
				errors: v.errors as ErrorObject[],
			}
		}
		return { value: value as Static<typeof schema> }
	}
}
