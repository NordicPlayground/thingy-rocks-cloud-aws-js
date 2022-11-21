import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'
import { fromEnv } from '@nordicsemiconductor/from-env'
const { TableName } = fromEnv({ TableName: 'CONNECTIONS_TABLE_NAME' })(
	process.env,
)

const db = new DynamoDBClient({})

export const handler = async (
	event: APIGatewayProxyWebsocketEventV2,
): Promise<void> => {
	console.log(
		JSON.stringify({
			event,
		}),
	)

	await db.send(
		new PutItemCommand({
			TableName,
			Item: {
				connectionId: {
					S: event.requestContext.connectionId,
				},
				ttl: {
					N: `${Math.round(Date.now() / 1000) + 60 * 60}`,
				},
			},
		}),
	)
}
