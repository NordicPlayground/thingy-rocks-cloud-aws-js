import {
	ApiGatewayManagementApi,
	PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi'
import {
	DeleteItemCommand,
	DynamoDBClient,
	ScanCommand,
} from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
const { TableName, apiEndpoint } = fromEnv({
	TableName: 'CONNECTIONS_TABLE_NAME',
	apiEndpoint: 'API_ENDPOINT',
})(process.env)

const db = new DynamoDBClient({})
const apiGwManagementClient = new ApiGatewayManagementApi({
	endpoint: apiEndpoint,
})

export const handler = async (event: {
	reported: Record<string, any>
	deviceId: string
}): Promise<void> => {
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

	for (const { connectionId } of res?.Items ?? []) {
		if (connectionId?.S === undefined) {
			console.debug(`No connection ID defined`, connectionId)
			continue
		}
		try {
			await apiGwManagementClient.send(
				new PostToConnectionCommand({
					ConnectionId: connectionId.S,
					Data: Buffer.from(
						JSON.stringify({
							'@context': 'https://thingy.rocks/device-event',
							...event,
						}),
					),
				}),
			)
		} catch (err) {
			if ((err as Error).name === 'GoneException') {
				console.debug(`Client is gone`, connectionId)
				await db.send(
					new DeleteItemCommand({
						TableName,
						Key: {
							connectionId: {
								S: connectionId.S,
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
