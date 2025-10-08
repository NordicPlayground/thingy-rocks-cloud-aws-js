import { type IoTClient, DescribeThingCommand } from '@aws-sdk/client-iot'

export const thingExists = async (
	iotClient: IoTClient,
	thingName: string,
): Promise<boolean> => {
	try {
		const response = await iotClient.send(
			new DescribeThingCommand({ thingName }),
		)
		console.log('Thing exists:', response)
		return true
	} catch (err: any) {
		if (err.name === 'ResourceNotFoundException') {
			console.log('Thing does not exist')
			return false
		} else {
			return false
		}
	}
}
