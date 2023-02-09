import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DescribeThingCommand, IoTClient } from '@aws-sdk/client-iot'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { notifyClients } from './notifyClients.js'

const { connectionsTableName, websocketManagementAPIURL } = fromEnv({
	connectionsTableName: 'CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
})(process.env)

const iot = new IoTClient({})
const db = new DynamoDBClient({})
const apiGwManagementClient = new ApiGatewayManagementApi({
	endpoint: websocketManagementAPIURL,
})
const notifier = notifyClients({
	db,
	connectionsTableName,
	apiGwManagementClient,
})

export const handler = async (event: {
	deviceId: string
	message: string
}): Promise<void> => {
	console.log(JSON.stringify({ event }))
	console.log(
		JSON.stringify({
			message: Buffer.from(event.message, 'base64').toString(),
		}),
	)
	try {
		const res = await iot.send(
			new DescribeThingCommand({
				thingName: event.deviceId,
			}),
		)

		if (res.attributes?.name !== undefined) {
			// Notify about names
			await notifier({
				deviceId: event.deviceId,
				deviceAlias: res.attributes.name,
				lightbulb: {
					type: 'rgb',
				},
			})
		}
	} catch (err) {
		console.error(err)
	}
}
