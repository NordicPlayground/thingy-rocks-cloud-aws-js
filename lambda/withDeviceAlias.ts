import { IoTClient } from '@aws-sdk/client-iot'
import type { notifyClients } from './notifyClients.js'

import { DescribeThingCommand } from '@aws-sdk/client-iot'

/**
 * Augments device events with their alias
 */
export const withDeviceAlias = <N extends ReturnType<typeof notifyClients>>(
	iot: IoTClient,
): ((notifier: N) => (event: Parameters<N>[0]) => Promise<void>) => {
	const info = getDeviceInfo(iot)
	return (notifier: N) =>
		async (event: Parameters<N>[0]): Promise<void> => {
			if (!('deviceId' in event)) return notifier(event)
			const { alias: deviceAlias, location, type } = await info(event.deviceId)
			return notifier({
				...event,
				deviceAlias,
				deviceLocation: location,
				deviceType: type,
			})
		}
}

const deviceInfo: Record<
	string,
	{ alias?: string; location?: string; type?: string }
> = {}

export const getDeviceInfo =
	(iot: IoTClient) =>
	async (
		deviceId: string,
	): Promise<{ alias?: string; location?: string; type?: string }> => {
		const info =
			deviceInfo[deviceId] ?? (await getDeviceAttributes(iot)(deviceId))
		if (!(deviceId in deviceInfo)) deviceInfo[deviceId] = info

		return info
	}

const getDeviceAttributes = (iot: IoTClient) => async (deviceId: string) => {
	const { attributes, thingTypeName } = await iot.send(
		new DescribeThingCommand({ thingName: deviceId }),
	)
	const { name, location } = attributes ?? {}
	return {
		alias: name,
		location,
		type: thingTypeName,
	}
}
