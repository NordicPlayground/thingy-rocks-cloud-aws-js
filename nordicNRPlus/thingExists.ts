import { type IoTClient, DescribeThingCommand } from '@aws-sdk/client-iot'

export const thingExists = async (
	iotClient: IoTClient,
	thingName: string,
): Promise<boolean> => {
	try {
		await iotClient.send(new DescribeThingCommand({ thingName }))
		return true
	} catch (err: any) {
		return false
	}
}
