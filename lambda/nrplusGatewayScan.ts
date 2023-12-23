import { IoTClient, ListThingsCommand } from '@aws-sdk/client-iot'
import {
	IoTDataPlaneClient,
	PublishCommand,
} from '@aws-sdk/client-iot-data-plane'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'

const iot = new IoTClient({})
const iotData = new IoTDataPlaneClient({})
const ssm = new SSMClient({})

const scanCommandPromise = (async () => {
	const r = await ssm.send(
		new GetParameterCommand({
			Name: '/thingy.rocks/nrplus/gatewayScanCommand',
		}),
	)
	return r.Parameter?.Value ?? 'dect beacon_scan -c 1697 -f -t 2'
})()

/**
 * Periodically trigger scan in sink to sync with relay,
 * required to communicate reliably with relay and relay-connected clients
 */
export const handler = async (): Promise<void> => {
	const { things: gateways } = await iot.send(
		new ListThingsCommand({
			thingTypeName: 'nrplus-gateway',
		}),
	)

	const scanCommand = await scanCommandPromise

	await Promise.all(
		(gateways ?? []).map(async ({ thingName }) => {
			const topic = `${thingName}/nrplus-ctrl`
			console.log(`>`, topic, JSON.stringify(scanCommand))
			return iotData.send(
				new PublishCommand({
					topic,
					payload: Buffer.from(scanCommand, 'utf-8'),
					qos: 1,
				}),
			)
		}),
	)
}
