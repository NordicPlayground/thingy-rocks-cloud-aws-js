import {
	ApiGatewayManagementApiClient,
	PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi'
import {
	DeleteItemCommand,
	DynamoDBClient,
	ScanCommand,
} from '@aws-sdk/client-dynamodb'
import type { Summary } from './chartSummary.js'

export enum LocationSource {
	MCELL = 'MCELL',
	SCELL = 'SCELL',
	WIFI = 'WIFI',
}

export type GeoLocation = {
	lat: number
	lng: number
	accuracy: number
	source: LocationSource
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
	// The fixed geo-location of the device,
	deviceLocation?: string // e.g.: 63.42115901688979,10.437200141182338
	// The thingy type
	deviceType?: string
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
		geoLocation: GeoLocation
	}
}

export type MemfaultUpdateReceived = {
	deviceId: string
	type: 'reboot'
}

export type Event =
	| DeviceEvent
	| CellGeoLocationEvent
	| (Record<string, any> & { '@context': URL })

export const notifyClients = (
	{
		db,
		connectionsTableName,
		apiGwManagementClient,
	}: {
		db: DynamoDBClient
		connectionsTableName: string
		apiGwManagementClient: ApiGatewayManagementApiClient
	},
	dropMessage = false,
): ((event: Event) => Promise<void>) => {
	const send = sendEvent(apiGwManagementClient)
	const getActive = getActiveConnections(db, connectionsTableName)
	return async (event: Event): Promise<void> => {
		console.log(
			JSON.stringify({
				event,
			}),
		)
		if (dropMessage) {
			console.debug(`Dropped message`)
			return
		}
		const connectionIds: string[] = await getActive()

		for (const connectionId of connectionIds) {
			try {
				const context =
					'@context' in event ? event['@context'] : getEventContext(event)
				if (context === null)
					throw new Error(`Unknown event: ${JSON.stringify(event)}`)
				await send(connectionId, event, context)
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
}

export const sendEvent =
	(client: ApiGatewayManagementApiClient) =>
	async (
		connectionId: string,
		event: Record<string, unknown>,
		context: URL,
	): Promise<void> => {
		console.log(`Notifying client`, connectionId)
		await client.send(
			new PostToConnectionCommand({
				ConnectionId: connectionId,
				Data: Buffer.from(
					JSON.stringify({
						'@context': context.toString(),
						...event,
					}),
				),
			}),
		)
	}

const getEventContext = (event: Event): URL | null => {
	if ('reported' in event) return new URL('https://thingy.rocks/device-shadow')
	if ('message' in event) return new URL('https://thingy.rocks/device-message')
	if ('location' in event)
		return new URL('https://thingy.rocks/device-location')
	if ('history' in event) return new URL('https://thingy.rocks/device-history')
	if ('cellGeoLocation' in event)
		return new URL('https://thingy.rocks/cell-geo-location')
	return null
}

export const getActiveConnections = (
	db: DynamoDBClient,
	connectionsTableName: string,
): (() => Promise<Array<string>>) => {
	let lastResult: {
		connectionIds: string[]
		ts: number
	}
	return async (): Promise<string[]> => {
		// Cache for 60 seconds
		if (lastResult !== undefined && lastResult.ts > Date.now() - 60 * 1000) {
			return lastResult.connectionIds
		}

		const res = await db.send(
			new ScanCommand({
				TableName: connectionsTableName,
			}),
		)

		const connectionIds: string[] = res?.Items?.map(
			({ connectionId }) => connectionId?.S,
		).filter((connectionId) => connectionId !== undefined) as string[]

		lastResult = {
			connectionIds,
			ts: Date.now(),
		}

		return connectionIds
	}
}
