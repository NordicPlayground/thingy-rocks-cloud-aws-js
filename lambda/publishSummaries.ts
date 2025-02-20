import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { IoTClient } from '@aws-sdk/client-iot'
import { TimestreamQueryClient } from '@aws-sdk/client-timestream-query'
import { fromEnv } from '@bifravst/from-env'
import { createChartSummary } from './chartSummary.ts'
import { listThingsInGroup } from './listThingsInGroup.ts'
import { getActiveConnections, notifyClients } from './notifyClients.ts'
import { withDeviceAlias } from './withDeviceAlias.ts'

const {
	connectionsTableName,
	websocketManagementAPIURL,
	historicaldataTableInfo,
	lwm2mObjectHistoryTableInfo,
} = fromEnv({
	connectionsTableName: 'CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
	historicaldataTableInfo: 'HISTORICALDATA_TABLE_INFO',
	lwm2mObjectHistoryTableInfo: 'LWM2M_OBJECT_HISTORY_TABLE_INFO',
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

const [historicaldataDatabaseName, historicaldataTableName] =
	historicaldataTableInfo.split('|') as [string, string]

const [lwm2mObjectHistoryDbName, lwm2mObjectHistoryTableName] =
	lwm2mObjectHistoryTableInfo.split('|') as [string, string]

const timestream = new TimestreamQueryClient({})

const getActive = getActiveConnections(db, connectionsTableName)

const lwm2mHistoryDevices = await listThingsInGroup(iot)('lwm2m-history')

export const handler = async (): Promise<void> => {
	const connectionIds: string[] = await getActive()
	if (connectionIds.length === 0) {
		console.log(`No clients to notify.`)
		return
	}

	const summaries = await createChartSummary({
		historicaldataDatabaseName,
		historicaldataTableName,
		lwm2mObjectHistoryDbName,
		lwm2mObjectHistoryTableName,
		timestream,
		lwm2mHistoryDevices,
	})

	console.log(JSON.stringify({ summaries }))

	for (const [deviceId, history] of Object.entries(summaries)) {
		await notifier({
			deviceId,
			history,
		})
	}
}
