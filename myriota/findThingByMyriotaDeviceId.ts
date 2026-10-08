import {
	ListThingsCommand,
	type ListThingsCommandOutput,
} from '@aws-sdk/client-iot'

export const MYRIOTA_DEVICE_ID_ATTRIBUTE = 'myriotaDeviceId'

/**
 * Finds the IoT thing which has the attribute `myriotaDeviceId` set to the
 * given Myriota device ID (the `TerminalId` of a packet).
 *
 * Lookup results (including misses) are remembered for the lifetime of the
 * Lambda instance.
 */
export const findThingByMyriotaDeviceId = (iot: {
	send: (
		command: ListThingsCommand,
	) => Promise<Pick<ListThingsCommandOutput, 'things'>>
}): ((myriotaDeviceId: string) => Promise<string | null>) => {
	const cache = new Map<string, Promise<string | null>>()
	return async (myriotaDeviceId) => {
		let thingName = cache.get(myriotaDeviceId)
		if (thingName === undefined) {
			thingName = iot
				.send(
					new ListThingsCommand({
						attributeName: MYRIOTA_DEVICE_ID_ATTRIBUTE,
						attributeValue: myriotaDeviceId,
						maxResults: 1,
					}),
				)
				.then((res) => res.things?.[0]?.thingName ?? null)
			cache.set(myriotaDeviceId, thingName)
			// Don't remember failed lookups
			thingName.catch(() => cache.delete(myriotaDeviceId))
		}
		return thingName
	}
}
