import {
	AddThingToThingGroupCommand,
	AttachThingPrincipalCommand,
	CreateThingCommand,
	DescribeCertificateCommand,
	IoTClient,
	ListThingGroupsForThingCommand,
	ListThingPrincipalsCommand,
	ListThingsCommand,
	RegisterCertificateCommand,
} from '@aws-sdk/client-iot'
import chalk from 'chalk'

const FROM_REGION = 'us-west-2'
const TO_REGION = 'eu-central-1'
const fromIot = new IoTClient({ region: FROM_REGION })
const toIot = new IoTClient({ region: TO_REGION })

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
		const { principals } = await fromIot.send(
			new ListThingPrincipalsCommand({
				thingName: device,
			}),
		)

		const certificates = await Promise.all(
			(principals ?? []).map(async (principal) => {
				const cert = await fromIot.send(
					new DescribeCertificateCommand({
						certificateId: principal.split('/')[1],
					}),
				)

				return cert.certificateDescription?.certificatePem
			}),
		)

		const certificateArns = await Promise.all(
			certificates.map(async (cert) => {
				const registeredCert = await toIot.send(
					new RegisterCertificateCommand({
						certificatePem: cert,
						status: 'ACTIVE',
					}),
				)

				return registeredCert.certificateArn
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

		const groups = await fromIot.send(
			new ListThingGroupsForThingCommand({ thingName: device }),
		)

		await Promise.all(
			(groups.thingGroups ?? [])?.map(async (group) =>
				toIot.send(
					new AddThingToThingGroupCommand({
						thingGroupName: group.groupName,
						thingName: device,
					}),
				),
			),
		)

		await Promise.all(
			certificateArns.map(async (certArn) =>
				toIot.send(
					new AttachThingPrincipalCommand({
						thingName: device,
						principal: certArn,
					}),
				),
			),
		)

		console.log(chalk.green(`Successfully migrated ${device}!`))
	} catch (error) {
		console.error(chalk.red(`Failed to migrate ${device}!`))
		console.error(chalk.red((error as Error).message))
	}
}
