import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { TimestreamQueryClient } from '@aws-sdk/client-timestream-query'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { createChartSummary } from './chartSummary.js'
import { getActiveConnections, notifyClients } from './notifyClients.js'

const {
	connectionsTableName,
	websocketManagementAPIURL,
	historicaldataTableInfo,
} = fromEnv({
	connectionsTableName: 'CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
	historicaldataTableInfo: 'HISTORICALDATA_TABLE_INFO',
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

const [historicaldataDatabaseName, historicaldataTableName] =
	historicaldataTableInfo.split('|') as [string, string]

const timestream = new TimestreamQueryClient({})

export const handler = async (): Promise<void> => {
	const connectionIds: string[] = await getActiveConnections(
		db,
		connectionsTableName,
	)

	if (connectionIds.length === 0) {
		console.log(`No clients to notify.`)
		return
	}

	const summaries = await createChartSummary({
		historicaldataDatabaseName,
		historicaldataTableName,
		timestream,
	})

	console.log(JSON.stringify({ summaries }))

	for (const [deviceId, history] of Object.entries(summaries)) {
		await notifier({
			deviceId,
			history,
		})
	}
}
