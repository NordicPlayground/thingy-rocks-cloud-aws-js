import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { notifyClients } from './notifyClients.js'

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
const notifier = notifyClients({
	db,
	connectionsTableName,
	apiGwManagementClient,
})

export const handler = async (event: {
	roam: {
		v: {
			band: number // 20
			nw: string // 'LTE-M'
			rsrp: number // -84
			area: number // 30401
			mccmnc: number // 24201
			cell: number // 21679616
			ip: string // '100.74.127.54'
		}
		ts: number // 1669651881654
	}
	deviceId: string // '351358815341265'
}): Promise<void> => {
	console.log(JSON.stringify({ event, geolocationApiUrl }))

	const {
		roam: {
			v: { nw, area, mccmnc, cell },
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
	console.log({ request })
	const res = await fetch(`${geolocationApiUrl}cell?${query.toString()}`)
	const body = await res.json()
	switch (res.status) {
		case 409:
			console.log(`Processing ...`)
			break
		case 200:
			console.log({ result: JSON.stringify(body) })
			await notifier({
				deviceId,
				location: { ...body, source: 'single-cell' },
			})
			break
		default:
			console.error(JSON.stringify(body))
			throw new Error(`Request failed!`)
	}
}
