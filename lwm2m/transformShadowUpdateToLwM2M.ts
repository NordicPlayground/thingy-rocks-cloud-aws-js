import jsonata from 'jsonata'
import {
	senMLtoLwM2M,
	type LwM2MObjectInstance,
	type Transformer,
} from '@hello.nrfcloud.com/proto-lwm2m'

type Update = {
	state: {
		reported?: Record<string, unknown>
		desired?: Record<string, unknown>
	}
}

/**
 * Very simple implementation of a converter.
 */
export const transformShadowUpdateToLwM2M = (
	transformers: Readonly<Array<Transformer>>,
): ((update: Update) => Promise<ReturnType<typeof senMLtoLwM2M>>) => {
	// Turn the JSONata in the transformers into executable functions
	const transformerFns: Array<{
		match: ReturnType<typeof jsonata>
		matchExpression: string
		transform: ReturnType<typeof jsonata>
		transformExpression: string
	}> = []

	for (const {
		match: matchExpression,
		transform: transformExpression,
	} of transformers) {
		let match: ReturnType<typeof jsonata>
		let transform: ReturnType<typeof jsonata>
		try {
			match = jsonata(matchExpression)
		} catch {
			throw new Error(`Failed to parse match expression '${matchExpression}'`)
		}
		try {
			transform = jsonata(transformExpression)
		} catch {
			throw new Error(
				`Failed to parse match expression '${transformExpression}'`,
			)
		}
		transformerFns.push({
			match,
			matchExpression,
			transform,
			transformExpression,
		})
	}

	return async (input: Update): Promise<Array<LwM2MObjectInstance>> =>
		Promise.all(
			transformerFns.map(
				async ({ match, matchExpression, transform, transformExpression }) => {
					// Check if the `matched` JSONata returns `true`.
					try {
						const matched = await match.evaluate(input)
						if (typeof matched !== 'boolean') return null
						if (matched === false) return null
					} catch (err) {
						console.error(err)
						console.error(
							`Failed to match ${JSON.stringify(
								input,
							)} using expression '${matchExpression}'!`,
						)
						return false
					}
					// Transform
					try {
						return await transform.evaluate(input)
					} catch (err) {
						console.error(err)
						console.error(
							`Failed to transform ${JSON.stringify(
								input,
							)} using expression '${transformExpression}'!`,
						)
						return null
					}
				},
			),
		)
			.then((result) => result.flat())
			// Ignore unmatched transformers
			.then((result) => result.filter((item) => item !== null))
			// Convert it to LwM2M
			.then(senMLtoLwM2M)
			// Handle errors
			.catch((err) => {
				console.error(err)
				console.error(`Failed to transform ${JSON.stringify(input)}!`)
				return []
			})
}
