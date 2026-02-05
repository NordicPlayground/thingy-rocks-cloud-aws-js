import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { IoTClient } from '@aws-sdk/client-iot'
import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane'
import { fromEnv } from '@bifravst/from-env'
import {
	type Geolocation_14201,
	type LwM2MObjectInstance,
	LwM2MObjectID,
} from '@hello.nrfcloud.com/proto-map/lwm2m'
import { getActiveConnections, notifyClients } from './notifyClients.ts'
import { updateShadow } from './updateShadow.ts'
import { withDeviceAlias } from './withDeviceAlias.ts'

const { connectionsTableName, websocketManagementAPIURL, geolocationApiUrl } =
	fromEnv({
		connectionsTableName: 'CONNECTIONS_TABLE_NAME',
		websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
		geolocationApiUrl: 'GEOLOCATION_API_URL',
	})(process.env)

const db = new DynamoDBClient({})
export const apiGwManagementClient = new ApiGatewayManagementApi({
	endpoint: websocketManagementAPIURL,
})
const iot = new IoTClient({})
const notifier = withDeviceAlias(iot)(
	notifyClients({
		db,
		connectionsTableName,
		apiGwManagementClient,
	}),
)

const getActive = getActiveConnections(db, connectionsTableName)

const update = updateShadow(new IoTDataPlaneClient())

export const handler = async (event: {
	connectionInformation: {
		// https://github.com/hello-nrfcloud/proto-map/blob/49b882c8c2cf7ce34182699311707282f78818d9/lwm2m/14203.xml
		'0': string // Network mode, e.g. 'LTE-M'
		'1': number // Band, e.g. 20
		'2': number // RSRP, e.g. -81
		'3': number // Area, e.g. 37812
		'4': number // Cell, e.g. 10288929
		'5': number // MCCMNC, e.g. 24491
		'6': string // IP address, e.g. '10.126.17.185'
		'99': number // Timestamp, e.g. 1770242101
	}
	scellLocation: {
		'0': number // lat, e.g. -34.9221747
		'1': number // lng, e.g. 138.605534
		'3': number // accuracy, e.g. 163.164
		'6': string // source, e.g. 'SCELL'
		'99': number // ts, e.g.  1770275198
	}
	deviceId: string // '355025930008394'
}): Promise<void> => {
	console.log(JSON.stringify({ event, geolocationApiUrl }))

	const connectionIds: string[] = await getActive()
	if (connectionIds.length === 0) {
		console.log(`No clients to notify.`)
		return
	}

	const {
		connectionInformation: {
			['0']: nw,
			['3']: area,
			['4']: cell,
			['5']: mccmnc,
			['99']: ts,
		},
		scellLocation: {
			['0']: SCELLlat,
			['1']: SCELLlng,
			['3']: SCELLaccuracy,
			['6']: SCELLsource,
		},
		deviceId,
	} = event

	const request = {
		cell: `${cell}`,
		area: `${area}`,
		mccmnc: `${mccmnc}`,
		nw: nw.includes('NB-IoT') ? 'nbiot' : 'ltem',
	}

	const query = new URLSearchParams(request)
	console.log(`[${deviceId}]`, { request })
	const res = await fetch(`${geolocationApiUrl}cell?${query.toString()}`)
	const body = await res.json()
	const { lat, lng, accuracy, source } = body
	const location: LwM2MObjectInstance<Geolocation_14201> = {
		ObjectID: LwM2MObjectID.Geolocation_14201,
		ObjectVersion: '1.0',
		ObjectInstanceID: 2,
		Resources: {
			0: lat,
			1: lng,
			6: source,
			99: ts,
			3: accuracy,
		},
	}

	if (
		SCELLsource === source &&
		SCELLlat === lat &&
		SCELLlng === lng &&
		SCELLaccuracy === accuracy
	) {
		console.log(`[${deviceId}]`, `No change`)
		return
	}

	switch (res.status) {
		case 409:
			console.log(`[${deviceId}]`, `Processing ...`)
			break
		case 200:
			console.log(`[${deviceId}]`, { result: JSON.stringify(body) })

			// Persist in shadow
			await update(deviceId, [location])

			// Notify active clients
			await notifier({
				deviceId,
				location: body,
				ts,
			})
			break
		default:
			console.error(`[${deviceId}]`, JSON.stringify(body))
			throw new Error(`Request failed!`)
	}
}
