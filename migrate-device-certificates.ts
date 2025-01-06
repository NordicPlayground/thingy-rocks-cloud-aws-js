import {
	AttachThingPrincipalCommand,
	CreateThingCommand,
	IoTClient,
	ListThingsCommand,
	RegisterCertificateCommand,
} from '@aws-sdk/client-iot'
import chalk from 'chalk'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const FROM_REGION = 'eu-central-1'
const fromIot = new IoTClient({ region: FROM_REGION })
const toIot = new IoTClient({ region: 'us-west-2' })

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const listDevices = async (iot: IoTClient) =>
	new Map(
		(
			(
				await iot.send(
					new ListThingsCommand({
						maxResults: 250,
					}),
				)
			).things ?? []
		)
			.filter(
				(device) =>
					device.thingTypeName !== 'mesh-node' &&
					device.thingTypeName !== 'wirepas-5g-mesh-gateway' &&
					device.thingTypeName !== 'nrplus-gateway',
			)
			.map((device) => [device.thingName, device]),
	)

const fromDevices = await listDevices(fromIot)
const toDevices = await listDevices(toIot)

const devicesToMigrate = new Set(
	fromDevices.values().map((device) => device.thingName),
).difference(new Set(toDevices.values().map((device) => device.thingName)))

for (const device of devicesToMigrate) {
	try {
		const { clientCert } = JSON.parse(
			await readFile(
				path.join(
					__dirname,
					'certificates',
					FROM_REGION,
					`device-${device}.json`,
				),
				'utf-8',
			),
		)

		const registeredCert = await toIot.send(
			new RegisterCertificateCommand({
				certificatePem: clientCert,
				status: 'ACTIVE',
			}),
		)

		await toIot.send(
			new CreateThingCommand({
				thingName: device,
				attributePayload: {
					attributes: fromDevices.get(device)!.attributes,
				},
			}),
		)

		await toIot.send(
			new AttachThingPrincipalCommand({
				thingName: device,
				principal: registeredCert.certificateArn!,
			}),
		)

		console.log(chalk.green(`Successfully migrated ${device}!`))
	} catch (error) {
		console.error(chalk.red(`Failed to migrate ${device}!`))
		console.error(chalk.red((error as Error).message))
	}
}
