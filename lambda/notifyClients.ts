import {
	ApiGatewayManagementApiClient,
	PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi'
import {
	DeleteItemCommand,
	DynamoDBClient,
	ScanCommand,
} from '@aws-sdk/client-dynamodb'
import type { Summary } from './chartSummary'

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
	deviceAlias?: string
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
	| {
			history: Summary
	  }
)

export type CellGeoLocationEvent = {
	cellGeoLocation: {
		cell: Cell
		geoLocation: Omit<GeoLocation, 'source'>
	}
}

export type Wirepas5GMeshNodePayload =
	| { counter: number }
	| { button: number }
	| { led: Record<number, number> }

export type Wirepas5GMeshNodeEvent = {
	meshNodeEvent: {
		meta: {
			node: string
			gateway: string
			rxTime: Date
			travelTimeMs: number
			hops: number
		}
		message: Wirepas5GMeshNodePayload
	}
}

type Event = DeviceEvent | CellGeoLocationEvent | Wirepas5GMeshNodeEvent

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
		const connectionIds: string[] = await getActiveConnections(
			db,
			connectionsTableName,
		)

		for (const connectionId of connectionIds) {
			try {
				const context = getEventContext(event)
				if (context === null)
					throw new Error(`Unknown event: ${JSON.stringify(event)}`)
				console.log(`Notifying client`, connectionId)

				await apiGwManagementClient.send(
					new PostToConnectionCommand({
						ConnectionId: connectionId,
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
					console.log(`Client is gone`, connectionId)
					await db.send(
						new DeleteItemCommand({
							TableName: connectionsTableName,
							Key: {
								connectionId: {
									S: connectionId,
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
	if ('history' in event) return 'https://thingy.rocks/device-history'
	if ('cellGeoLocation' in event)
		return 'https://thingy.rocks/cell-geo-location'
	if ('meshNodeEvent' in event)
		return 'https://thingy.rocks/wirepas-5g-mesh-node-event'
	return null
}
export async function getActiveConnections(
	db: DynamoDBClient,
	connectionsTableName: string,
): Promise<string[]> {
	const res = await db.send(
		new ScanCommand({
			TableName: connectionsTableName,
		}),
	)

	const connectionIds: string[] = res?.Items?.map(
		({ connectionId }) => connectionId?.S,
	).filter((connectionId) => connectionId !== undefined) as string[]
	return connectionIds
}
