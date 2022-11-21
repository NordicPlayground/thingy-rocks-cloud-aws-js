import {
	ApiGatewayManagementApi,
	PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
const { TableName } = fromEnv({ TableName: 'CONNECTIONS_TABLE_NAME' })(
	process.env,
)

const db = new DynamoDBClient({})
const apiGwManagementClient = new ApiGatewayManagementApi({})

export const handler = async (event: any): Promise<void> => {
	console.log(
		JSON.stringify({
			event,
		}),
	)
	const res = await db.send(
		new ScanCommand({
			TableName,
		}),
	)

	for (const connection of res?.Items ?? []) {
		console.log(JSON.stringify({ connection }))
		await apiGwManagementClient.send(
			new PostToConnectionCommand({
				ConnectionId: connection?.S as unknown as string,
				Data: event,
			}),
		)
	}
}
