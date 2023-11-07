import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { Type } from '@sinclair/typebox'
import { LocationSource, Network, notifyClients } from './notifyClients.js'
import { validateWithTypeBox } from './validateWithTypeBox.js'
import { IoTClient, SearchIndexCommand } from '@aws-sdk/client-iot'
import {
	LwM2MObjectID,
	type ConnectionInformation_14203,
} from '@hello.nrfcloud.com/proto-lwm2m'
import {
	IoTDataPlaneClient,
	UpdateThingShadowCommand,
} from '@aws-sdk/client-iot-data-plane'
import { objectsToShadow } from '../lwm2m/objectsToShadow.js'

const { connectionsTableName, websocketManagementAPIURL } = fromEnv({
	connectionsTableName: 'CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
})(process.env)

const db = new DynamoDBClient({})
const apiGwManagementClient = new ApiGatewayManagementApi({
	endpoint: websocketManagementAPIURL,
})
const notifier = notifyClients({
	db,
	connectionsTableName,
	apiGwManagementClient,
})

enum Nw {
	lteM = 'ltem',
	nbIoT = 'nbiot',
}

const iot = new IoTClient({})
const iotData = new IoTDataPlaneClient({})

const validateCellGeoLocation = validateWithTypeBox(
	Type.Object({
		area: Type.Integer({ minimum: 1 }),
		cell: Type.Integer({ minimum: 1 }),
		mccmnc: Type.Integer({ minimum: 1 }),
		nw: Type.Enum(Nw),
		cellgeo: Type.Object({
			lat: Type.Number({
				minimum: -90,
				maximum: 90,
				description: 'Global grid line, north to south. Vertical.',
			}),
			lng: Type.Number({
				minimum: -180,
				maximum: 180,
				description: 'Global grid line, east to west. Horizontal.',
			}),
			accuracy: Type.Number({
				minimum: 0,
				description:
					'Radius of the uncertainty circle around the location in meters. Also known as Horizontal Positioning Error (HPE).',
			}),
			located: Type.Literal(true),
			source: Type.Enum(LocationSource),
		}),
	}),
)

export const handler = async (event: {
	source: string //'aws.states'
	detail: {
		status: 'SUCCEEDED' | 'FAILED' // 'SUCCEEDED'
		output: string //'{"area":30401,"cell":21679616,"mccmnc":24201,"nw":"ltem","cellgeo":{"lat":63.419001,"lng":10.437035,"accuracy":500,"located":true,"source":"nrfcloud"},"storedInCache":true}'
	}
}): Promise<void> => {
	const {
		source: eventSource,
		detail: { status, output },
	} = event
	console.log(JSON.stringify({ event }))
	if (eventSource !== 'aws.states')
		throw new Error(`Unexpected source: ${eventSource}!`)
	if (status !== 'SUCCEEDED') throw new Error(`Unexpected status: ${status}!`)
	const result = JSON.parse(output)

	const maybeValid = validateCellGeoLocation(result)
	if ('errors' in maybeValid) {
		console.error(JSON.stringify(maybeValid.errors))
		throw new Error(`Unexpected result: ${result}`)
	}

	const {
		area,
		cell,
		mccmnc,
		nw,
		cellgeo: { lat, lng, accuracy, source },
	} = maybeValid.value

	await notifier({
		cellGeoLocation: {
			cell: {
				area,
				cell,
				mccmnc,
				nw: nw === Nw.nbIoT ? Network.nbIoT : Network.lteM,
			},
			geoLocation: { lat, lng, accuracy, source },
		},
	})

	for (const { shadow, thingName } of (
		await iot.send(
			new SearchIndexCommand({
				queryString: `connectivity.timestamp > ${
					Date.now() - 24 * 60 * 60 * 1000
				}`,
			}),
		)
	).things ?? []) {
		if (shadow === undefined) continue
		if (shadow === null) continue
		const connRes =
			JSON.parse(shadow).name.lwm2m?.reported?.[
				`${LwM2MObjectID.ConnectionInformation_14203}:1.0`
			]?.['0']
		if (connRes === undefined) continue
		const connection: ConnectionInformation_14203 = {
			ObjectID: LwM2MObjectID.ConnectionInformation_14203,
			ObjectVersion: '1.0',
			Resources: connRes,
		}

		const thingCell = {
			nw: connection.Resources[0],
			cell: connection.Resources['4'],
			mccmnc: connection.Resources['5'],
			area: connection.Resources['3'],
		}

		if (
			thingCell.nw === nw &&
			thingCell.cell === cell &&
			thingCell.mccmnc === mccmnc &&
			thingCell.area === area
		) {
			await iotData.send(
				new UpdateThingShadowCommand({
					thingName,
					shadowName: 'lwm2m',
					payload: JSON.stringify({
						state: {
							reported: objectsToShadow([
								{
									ObjectID: LwM2MObjectID.Geolocation_14201,
									ObjectInstanceID: 2,
									ObjectVersion: '1.0',
									Resources: {
										0: lat,
										1: lng,
										3: accuracy,
										6: source,
										99: Date.now(),
									},
								},
							]),
						},
					}),
				}),
			)
		} else {
			console.debug(`No match`, thingCell)
		}
	}
}
