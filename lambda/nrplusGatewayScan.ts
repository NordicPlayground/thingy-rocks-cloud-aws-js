import { IoTClient, ListThingsCommand } from '@aws-sdk/client-iot'
import {
	IoTDataPlaneClient,
	PublishCommand,
} from '@aws-sdk/client-iot-data-plane'

const iot = new IoTClient({})
const iotData = new IoTDataPlaneClient({})

const thingsPromise = iot.send(
	new ListThingsCommand({
		thingTypeName: 'nrplus-gateway',
	}),
)

/**
 * Periodically trigger scan in sink to sync with relay,
 * required to communicate reliably with relay and relay-connected clients
 */
export const handler = async (): Promise<void> => {
	const { things: gateways } = await thingsPromise

	await Promise.all(
		(gateways ?? []).map(async ({ thingName, attributes }) => {
			const topic = `${thingName}/nrplus-ctrl`
			const scanCommand = `dect beacon_scan -c ${attributes?.channel ?? '1697'} -f -t 2`
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
