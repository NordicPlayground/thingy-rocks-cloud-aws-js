import { IoTClient, ListThingsCommand } from '@aws-sdk/client-iot'
import {
	IoTDataPlaneClient,
	PublishCommand,
} from '@aws-sdk/client-iot-data-plane'

const iot = new IoTClient({})
const iotData = new IoTDataPlaneClient({})

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

	await Promise.all(
		(gateways ?? []).map(async ({ thingName }) => {
			const topic = `${thingName}/nrplus-ctrl`
			const payload = `dect beacon_scan -c 1667 -f -t 2`
			console.log(`>`, topic, JSON.stringify(payload))
			return iotData.send(
				new PublishCommand({
					topic,
					payload: Buffer.from(payload, 'utf-8'),
					qos: 1,
				}),
			)
		}),
	)
}
