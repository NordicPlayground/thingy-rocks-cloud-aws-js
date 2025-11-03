import { type IoTClient, DescribeThingCommand } from '@aws-sdk/client-iot'

export const thingExists =
	(iotClient: IoTClient) =>
	async (thingName: string): Promise<boolean> => {
		try {
			await iotClient.send(new DescribeThingCommand({ thingName }))
			return true
		} catch {
			return false
		}
	}
