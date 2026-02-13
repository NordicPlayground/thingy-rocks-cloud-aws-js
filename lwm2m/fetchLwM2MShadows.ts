import type {
	IoTClient,
	SearchIndexCommandOutput,
	ThingDocument,
} from '@aws-sdk/client-iot'
import { SearchIndexCommand } from '@aws-sdk/client-iot'
import {
	instanceTs,
	type LwM2MObjectInstance,
} from '@hello.nrfcloud.com/proto-map/lwm2m'
import { shadowToObjects } from '@hello.nrfcloud.com/proto-map/lwm2m/aws'
import { getDeviceInfo } from '../lambda/withDeviceAlias.ts'
import { lastUpdate } from './lastUpdate.ts'

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
		const things: Array<ThingDocument> = []
		let nextToken: string | undefined = undefined
		do {
			const res: SearchIndexCommandOutput = await iot.send(
				new SearchIndexCommand({
					// Find all things which have an LwM2M shadow
					queryString: 'shadow.name.lwm2m.hasDelta:*',
					nextToken,
					maxResults: 250,
				}),
			)
			nextToken = res.nextToken
			things.push(...(res.things ?? []))
		} while (nextToken !== undefined)

		return (
			await Promise.all<LwM2MShadow>(
				(things ?? [])
					// Ignore shadows which have not been updated recently
					.filter(({ shadow }) => {
						const metadata =
							JSON.parse(shadow ?? '{}').name.lwm2m.metadata?.reported ?? {}

						const ageInDays =
							(Date.now() - lastUpdate(metadata) * 1000) / 1000 / 60 / 60 / 24

						return ageInDays <= notOlderThanDays
					})
					.map(async ({ thingName, shadow }) => {
						const { alias, type, kinesisVideoStreamArn } = await deviceInfo(
							thingName as string,
						)
						const reported = JSON.parse(shadow ?? '{}').name.lwm2m.reported

						if (reported === undefined)
							return {
								deviceId: thingName as string,
								alias,
								deviceType: type,
								kinesisVideoStreamArn,
								objects: [],
							}

						try {
							return {
								deviceId: thingName as string,
								alias,
								deviceType: type,
								kinesisVideoStreamArn,
								objects: shadowToObjects(reported).filter((instance) => {
									const updateTs = instanceTs(instance)
									return (
										Date.now() - updateTs * 1000 <
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
								deviceType: type,
								kinesisVideoStreamArn,
								objects: [],
							}
						}
					}),
			)
		).filter(({ objects }) => objects.length > 0)
	}
}
