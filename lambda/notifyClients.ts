import {
	ApiGatewayManagementApiClient,
	PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi'
import {
	DeleteItemCommand,
	DynamoDBClient,
	ScanCommand,
} from '@aws-sdk/client-dynamodb'

export type GeoLocation = {
	lat: number
	lng: number
	accuracy: number
	source: 'single-cell' | 'multi-cell' | 'wifi' | 'gnss'
}

export enum Network {
	lteM = 'LTE-m',
	nbIoT = 'NB-IoT',
}
type Cell = {
	area: number //30401
	cell: number //21679616
	mccmnc: number //24201
	nw: Network
}

export type DeviceEvent = {
	deviceId: string
	receivedTimestamp: string
} & (
	| {
			reported: Record<string, any>
	  }
	| {
			message: Record<string, any>
	  }
	| {
			location: GeoLocation
	  }
)

export type CellGeoLocationEvent = {
	cellGeoLocation: {
		cell: Cell
		geoLocation: Omit<GeoLocation, 'source'>
	}
}

type Event = DeviceEvent | CellGeoLocationEvent

export const notifyClients =
	({
		db,
		connectionsTableName,
		apiGwManagementClient,
	}: {
		db: DynamoDBClient
		connectionsTableName: string
		apiGwManagementClient: ApiGatewayManagementApiClient
	}) =>
	async (event: Event): Promise<void> => {
		console.log(
			JSON.stringify({
				event,
			}),
		)
		const res = await db.send(
			new ScanCommand({
				TableName: connectionsTableName,
			}),
		)

		for (const { connectionId } of res?.Items ?? []) {
			if (connectionId?.S === undefined) {
				console.log(`No connection ID defined`, connectionId)
				continue
			}
			try {
				const context = getEventContext(event)
				if (context === null)
					throw new Error(`Unknown event: ${JSON.stringify(event)}`)
				console.log(`Notifying client`, connectionId.S)
				await apiGwManagementClient.send(
					new PostToConnectionCommand({
						ConnectionId: connectionId.S,
						Data: Buffer.from(
							JSON.stringify({
								'@context': context,
								...event,
							}),
						),
					}),
				)
			} catch (err) {
				if ((err as Error).name === 'GoneException') {
					console.log(`Client is gone`, connectionId.S)
					await db.send(
						new DeleteItemCommand({
							TableName: connectionsTableName,
							Key: {
								connectionId: {
									S: connectionId.S,
								},
							},
						}),
					)
					continue
				}
				console.error(err)
			}
		}
	}
const getEventContext = (event: Event): string | null => {
	if ('reported' in event) return 'https://thingy.rocks/device-shadow'
	if ('message' in event) return 'https://thingy.rocks/device-message'
	if ('location' in event) return 'https://thingy.rocks/device-location'
	if ('cellGeoLocation' in event)
		return 'https://thingy.rocks/cell-geo-location'
	return null
}
