import { IoTClient, SearchIndexCommand } from '@aws-sdk/client-iot'
import type { LwM2MObjectInstance } from '@hello.nrfcloud.com/proto-lwm2m'
import { shadowToObjects } from './shadowToObjects.js'
import { getDeviceInfo } from '../lambda/withDeviceAlias.js'
import { instanceTs } from './instanceTs.js'

type LwM2MShadow = {
	deviceId: string
	alias?: string
	objects: LwM2MObjectInstance[]
}

export const fetchLwM2MShadows = (
	iot: IoTClient,
): ((notOlderThanDays?: number) => Promise<LwM2MShadow[]>) => {
	const deviceInfo = getDeviceInfo(iot)
	return async (notOlderThanDays = 30) => {
		const { things } = await iot.send(
			new SearchIndexCommand({
				// Find all things which have an LwM2M shadow
				queryString: 'shadow.name.lwm2m.hasDelta:*',
			}),
		)
		return (
			await Promise.all<LwM2MShadow>(
				(things ?? []).map(async ({ thingName, shadow }) => {
					const alias = (await deviceInfo(thingName as string)).alias
					const reported = JSON.parse(shadow ?? '{}').name.lwm2m.reported
					if (reported === undefined)
						return {
							deviceId: thingName as string,
							alias,
							objects: [],
						}

					try {
						return {
							deviceId: thingName as string,
							alias,
							objects: shadowToObjects(reported).filter((instance) => {
								const updateTs = instanceTs(instance)
								return (
									Date.now() - updateTs.getTime() <
									notOlderThanDays * 24 * 60 * 60 * 1000
								)
							}),
						}
					} catch (err) {
						console.error(`Failed to convert shadow for thing ${thingName}`)
						console.log(
							JSON.stringify({
								thingName,
								shadow: {
									reported,
								},
							}),
						)
						console.error(err)
						return {
							deviceId: thingName as string,
							alias,
							objects: [],
						}
					}
				}),
			)
		).filter(({ objects }) => objects.length > 0)
	}
}
