import { CreateThingCommand, type IoTClient } from '@aws-sdk/client-iot'
import { thingExists } from '../nordicNRPlus/thingExists.ts'


export const ensureThingExists =
	(iotClient: IoTClient, thingExists: EnsureThingFn) => {
	
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
