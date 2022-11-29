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
			payload: Buffer.from(
				JSON.stringify({
					state: {
						reported: {
							cfg: {
								act: true,
								loct: 30,
								actwt: 60,
								mvres: 120,
								mvt: 3600,
								accath: 4,
								accith: 4,
								accito: 60,
								nod: [],
							},
							dev: {
								v: {
									imei: '351358815341265',
									iccid: '89457387300008502281',
									modV: 'mfw_nrf9160_1.3.2',
									brdV: 'thingy91_nrf9160',
									appV: '1.1.0-thingy91_nrf9160_ns',
								},
								ts,
							},
							roam: {
								v: {
									band: 20,
									nw: 'LTE-M',
									rsrp: -88,
									area: 30401,
									mccmnc: 24201,
									cell: 21679616,
									ip: '100.74.127.54',
								},
								ts,
							},
							env: {
								v: {
									temp: 27.75,
									hum: 13.257,
									atmp: 101.497,
								},
								ts,
							},
							bat: {
								v: 4398,
								ts,
							},
						},
					},
				}),
			),
		}),
	)
}

updateShadow().catch(console.error)

setInterval(updateShadow, 5000)
