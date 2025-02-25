import {
	type IoTClient,
	ListThingsCommand,
	type ThingAttribute,
} from '@aws-sdk/client-iot'

export const listDevices = async (
	iot: IoTClient,
): Promise<Map<string, ThingAttribute>> =>
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
			.map((device) => [device.thingName!, device]),
	)
