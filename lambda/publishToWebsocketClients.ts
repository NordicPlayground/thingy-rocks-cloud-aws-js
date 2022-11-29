import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { notifyClients } from './notifyClients.js'

const { TableName, websocketManagementAPIURL } = fromEnv({
	TableName: 'CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
})(process.env)

const db = new DynamoDBClient({})
export const apiGwManagementClient = new ApiGatewayManagementApi({
	endpoint: websocketManagementAPIURL,
})
const notifier = notifyClients({
	db,
	connectionsTableName: TableName,
	apiGwManagementClient,
})

export const handler = async (
	event: {
		deviceId: string
		receivedTimestamp: string
	} & (
		| {
				reported: Record<string, any>
		  }
		| {
				message: Record<string, any>
		  }
	),
): Promise<void> => {
	console.log(
		JSON.stringify({
			event,
		}),
	)
	await notifier(event)
}
