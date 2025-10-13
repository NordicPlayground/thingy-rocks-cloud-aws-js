import { CreateThingCommand, type IoTClient } from '@aws-sdk/client-iot'
import { thingExists } from '../nordicNRPlus/thingExists.ts'

export const ensureThingExists =
	(iotClient: IoTClient) =>
	async (thingName: string): Promise<void> => {
		if ((await thingExists(iotClient, thingName)) === false) {
			await iotClient.send(
				new CreateThingCommand({
					thingName,
					thingTypeName: 'nordic-nrplus',
				}),
			)
		}
	}
