import { CreateThingCommand, type IoTClient } from '@aws-sdk/client-iot'

type EnsureThingFn = (
	iotClient: IoTClient,
) => (thingName: string) => Promise<boolean>

export const ensureThingExists = (
	iotClient: IoTClient,
	thingExists: EnsureThingFn,
) => {
	const e = thingExists(iotClient)

	return async (thingName: string): Promise<void> => {
		if (await e(thingName)) return
		await iotClient.send(
			new CreateThingCommand({
				thingName,
				thingTypeName: 'nordic-nrplus',
			}),
		)
	}
}
