import { IoTClient, UpdateThingCommand } from '@aws-sdk/client-iot'
import chalk from 'chalk'
import { listDevices } from './aws/listDevices.ts'

const FROM_REGION = 'us-west-2'
const TO_REGION = 'eu-central-1'
const fromIot = new IoTClient({ region: FROM_REGION })
const toIot = new IoTClient({ region: TO_REGION })

const fromDevices = await listDevices(fromIot)

for (const [device, attributes] of fromDevices) {
	try {
		await toIot.send(
			new UpdateThingCommand({
				thingName: device,
				attributePayload: {
					attributes: fromDevices.get(device)!.attributes,
				},
			}),
		)

		console.log(
			chalk.green(`Successfully migrated ${device}!`),
			JSON.stringify(attributes.attributes),
		)
	} catch (error) {
		console.error(chalk.red(`Failed to migrate ${device}!`))
		console.error(chalk.red((error as Error).message))
	}
}
