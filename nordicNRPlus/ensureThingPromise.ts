export const ensureThingPromise = async (
	ensuredThings: Map<string, Promise<void>>,
	ensureThing: (thingName: string) => Promise<void>,
	thingName: string,
): Promise<void> => {
	let ensurePromise = ensuredThings.get(thingName)
	if (!ensurePromise) {
		ensurePromise = ensureThing(thingName).catch((error) => {
			// If it fails, remove it from cache to allow retries
			ensuredThings.delete(thingName)
			throw new Error(
				`Failed to ensure thing exists: ${thingName} with the error: ${(error as Error).message}`,
			)
		})
		ensuredThings.set(thingName, ensurePromise)
	}
	await ensurePromise
}
