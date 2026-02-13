import { fromEnv } from '@bifravst/from-env'
import {
	type ConnectionInformation_14203,
	type Environment_14205,
	type LwM2MObjectInstance,
	LwM2MObjectID,
} from '@hello.nrfcloud.com/proto-map/lwm2m'
import { lwm2mToSenML, toCBOR } from '@hello.nrfcloud.com/proto-map/senml'
import cbor from 'cbor'
import chalk from 'chalk'
import commandLineArgs from 'command-line-args'
import dgram from 'dgram'

const { metNoClientId } = fromEnv({
	metNoClientId: 'MET_NO_CLIENT_ID',
})(process.env)

const args = commandLineArgs([
	{ name: 'deviceId', alias: 'd', type: String },
	{
		name: 'met-station',
		type: String,
		defaultValue: 'SN18700', // Oslo (Blindern)
	},
])

if (args.deviceId === undefined) {
	console.error(
		chalk.red(`Device ID is required. Use --deviceId or -d to specify it.`),
	)
	process.exit(1)
}

console.log(
	chalk.yellow(`Starting UDP Device Simulator for Device ID`),
	chalk.cyan(args.deviceId),
)
console.log(
	chalk.yellow(`Using MET.no API with Client ID`),
	chalk.cyan(metNoClientId),
)

do {
	const res = await fetch(
		`https://frost.met.no/observations/v0.jsonld?${new URLSearchParams({
			sources: args['met-station'],
			referencetime: 'latest',
			elements: 'air_temperature',
		}).toString()}`,
		{
			headers: {
				Accept: 'application/json',
				Authorization: `Basic ${Buffer.from(`${metNoClientId}:`).toString('base64')}`,
			},
		},
	)

	const temp = (await res.json()).data?.[0]?.observations?.[0]?.value

	if (temp === undefined) {
		console.error(chalk.red(`Failed to fetch temperature data from MET.no`))
		process.exit(1)
	}

	console.log(
		chalk.green(`Fetched temperature data from MET.no:`),
		chalk.cyan(`${temp} °C`),
	)

	const net: LwM2MObjectInstance<ConnectionInformation_14203> = {
		ObjectID: LwM2MObjectID.ConnectionInformation_14203,
		ObjectVersion: '1.0',
		ObjectInstanceID: 2,
		Resources: {
			0: 'LAN',
			99: Math.floor(Date.now() / 1000),
		},
	}

	const env: LwM2MObjectInstance<Environment_14205> = {
		ObjectID: LwM2MObjectID.Environment_14205,
		ObjectVersion: '1.0',
		ObjectInstanceID: 2,
		Resources: {
			0: temp,
			99: Math.floor(Date.now() / 1000),
		},
	}

	const senml = []

	for (const obj of [net, env]) {
		const maybeSenML = lwm2mToSenML(obj)
		if ('errors' in maybeSenML) {
			console.error(
				chalk.red(
					`Failed to convert LwM2M data to senML for ObjectID ${obj.ObjectID}:`,
				),
			)
			maybeSenML.errors.forEach((err) =>
				console.error(chalk.red(`- ${err.message}`)),
			)
			process.exit(1)
		}
		senml.push(...maybeSenML.senML)
	}

	const cborData = cbor.encode([args.deviceId, toCBOR(senml)])

	const client = dgram.createSocket('udp4')

	client.send(cborData, 6667, 'udp.thingy.rocks', (err) => {
		if (err) {
			console.error(chalk.red(`Failed to send UDP packet: ${err.message}`))
			process.exit(1)
		}
		console.log(
			chalk.green(`CBOR data sent to`),
			chalk.cyan(`udp.thingy.rocks:6667`),
		)
		client.close()
	})

	client.on('error', (err) => {
		console.error(chalk.red(`UDP socket error: ${err.message}`))
		process.exit(1)
	})

	await new Promise((resolve) => setTimeout(resolve, 1000 * 60))
	// eslint-disable-next-line no-constant-condition
} while (true)
