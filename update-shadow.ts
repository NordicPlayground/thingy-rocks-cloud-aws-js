// Simulates a device that updates it's shadow

import { DescribeEndpointCommand, IoTClient } from '@aws-sdk/client-iot'
import {
	IoTDataPlaneClient,
	UpdateThingShadowCommand,
} from '@aws-sdk/client-iot-data-plane'
import chalk from 'chalk'

const iot = new IoTClient({})

const { endpointAddress } = await iot.send(
	new DescribeEndpointCommand({
		endpointType: 'iot:Data-ATS',
	}),
)
if (endpointAddress === undefined)
	throw new Error(`Failed to acquired IoT Core endpoint address!`)

console.log(chalk.magenta('Endpoint'), chalk.blue(endpointAddress))
const iotData = new IoTDataPlaneClient({
	endpoint: `https://${endpointAddress}`,
})

const thingName = process.argv[process.argv.length - 1]

console.log(chalk.magenta('Thing name'), chalk.blue(thingName))

const updateShadow = async () => {
	const ts = Math.round(Date.now() / 1000)
	console.log(chalk.magenta('Sending time'), chalk.blue(ts))
	await iotData.send(
		new UpdateThingShadowCommand({
			thingName,
			shadowName: 'demo',
			payload: Buffer.from(
				JSON.stringify({
					state: {
						reported: {
							ts,
						},
					},
				}),
			),
		}),
	)
}

updateShadow()

setInterval(updateShadow, 5000)
