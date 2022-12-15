import type { IoTClient } from '@aws-sdk/client-iot'
import type { notifyClients } from './notifyClients.js'

import { DescribeThingCommand } from '@aws-sdk/client-iot'

/**
 * Augments device events with their alias
 */
export const withDeviceAlias = <N extends ReturnType<typeof notifyClients>>(
	iot: IoTClient,
): ((notifier: N) => (event: Parameters<N>[0]) => Promise<void>) => {
	const alias = getDeviceAlias(iot)
	return (notifier: N) =>
		async (event: Parameters<N>[0]): Promise<void> => {
			if (!('deviceId' in event)) return notifier(event)
			const deviceAlias = await alias(event.deviceId)
			if (deviceAlias === undefined) return notifier(event)
			return notifier({
				...event,
				deviceAlias,
			})
		}
}

const deviceAliases: Record<string, string | undefined> = {}

const getDeviceAlias = (iot: IoTClient) => async (deviceId: string) => {
	if (!(deviceId in deviceAliases))
		deviceAliases[deviceId] = (
			await iot.send(new DescribeThingCommand({ thingName: deviceId }))
		)?.attributes?.name

	return deviceAliases[deviceId]
}
