import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import type { DynamoDBStreamEvent } from 'aws-lambda'
import { notifyClients } from './notifyClients.js'

const {
	connectionsTableName,
	websocketManagementAPIURL,
	neighborCellGeolocationApiUrl,
} = fromEnv({
	connectionsTableName: 'CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
	neighborCellGeolocationApiUrl: 'NCELLMEAS_API_URL',
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

export const handler = async (
	event: DynamoDBStreamEvent & {
		Records: [
			{
				dynamodb: {
					Keys: {
						reportId: {
							S: '85b0a8a4-cf4c-4c0c-85d3-dca5df4401c5'
						}
					}
					NewImage: {
						deviceId: {
							S: '351358811471140'
						}
					}
				}
			},
		]
	},
): Promise<void> => {
	console.log(JSON.stringify({ event, neighborCellGeolocationApiUrl }))
	for (const { dynamodb } of event.Records) {
		const reportId = dynamodb.Keys.reportId.S
		const deviceId = dynamodb.NewImage.deviceId.S
		console.log(`Resolving report ${reportId} from device ${deviceId}...`)
		const res = await fetch(
			`${neighborCellGeolocationApiUrl}report/${reportId}/location`,
		)
		const body = await res.json()
		switch (res.status) {
			case 409:
				console.log(`Processing ...`)
				break
			case 200:
				console.log({ result: JSON.stringify(body) })
				await notifier({
					deviceId,
					location: { ...body, source: 'multi-cell' },
				})
				break
			default:
				console.error(JSON.stringify(body))
				throw new Error(`Request failed!`)
		}
	}
}
