import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { TimestreamQueryClient } from '@aws-sdk/client-timestream-query'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { createChartSummary } from './chartSummary.js'
import { notifyClients } from './notifyClients.js'

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
