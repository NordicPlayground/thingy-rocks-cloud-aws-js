import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { IoTClient } from '@aws-sdk/client-iot'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { notifyClients } from './notifyClients.js'
import { withDeviceAlias } from './withDeviceAlias.js'

const { connectionsTableName, websocketManagementAPIURL } = fromEnv({
	connectionsTableName: 'CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
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

export const handler = async (
	event: {
		deviceId: string
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
