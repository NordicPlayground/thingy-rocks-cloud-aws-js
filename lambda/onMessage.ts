import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import type {
	APIGatewayProxyStructuredResultV2,
	APIGatewayProxyWebsocketEventV2,
} from 'aws-lambda'

const db = new DynamoDBClient({})

const { TableName } = fromEnv({
	TableName: 'CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
})(process.env)

export const handler = async (
	event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
	console.log(
		JSON.stringify({
			event,
		}),
	)

	await db.send(
		new UpdateItemCommand({
			TableName,
			Key: {
				connectionId: {
					S: event.requestContext.connectionId,
				},
			},
			UpdateExpression: 'SET #lastSeen = :lastSeen',
			ExpressionAttributeNames: {
				'#lastSeen': 'lastSeen',
			},
			ExpressionAttributeValues: {
				':lastSeen': {
					S: new Date().toISOString(),
				},
			},
		}),
	)

	return {
		statusCode: 200,
		body: `Got your message, ${event.requestContext.connectionId}!`,
	}
}
