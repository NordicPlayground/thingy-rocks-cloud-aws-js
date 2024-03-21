import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { IoTClient } from '@aws-sdk/client-iot'
import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { createAPIClient } from './memfault/api.js'
import { getActiveConnections, notifyClients } from './notifyClients.js'
import { withDeviceAlias } from './withDeviceAlias.js'
import pRetry from 'p-retry'

const ssm = new SSMClient({})
const iot = new IoTClient({})
const db = new DynamoDBClient({})

const { connectionsTableName, websocketManagementAPIURL, stackName } = fromEnv({
	connectionsTableName: 'CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
	stackName: 'STACK_NAME',
})(process.env)

export const apiGwManagementClient = new ApiGatewayManagementApi({
	endpoint: websocketManagementAPIURL,
})

const notifier = withDeviceAlias(iot)(
	notifyClients({
		db,
		connectionsTableName,
		apiGwManagementClient,
	}),
)

const getActive = getActiveConnections(db, connectionsTableName)

const api = await createAPIClient(ssm, stackName)

export const handler = async ({
	deviceId,
	timestamp,
	ts,
}: {
	deviceId: string
	timestamp: string
	ts: number
}): Promise<void> => {
	console.log(
		JSON.stringify({
			event: {
				deviceId,
				ts,
				timestamp,
			},
		}),
	)
	const connectionIds: string[] = await getActive()
	if (connectionIds.length === 0) {
		console.log(`No clients to notify.`)
		return
	}

	// Wait 15 seconds before polling
	await new Promise<any>((resolve) => setTimeout(resolve, 15 * 1000))
	await pRetry(
		async () => {
			const reboots = await api.getLastReboots(deviceId)
			const reboot = reboots?.[0]
			if (reboot === undefined)
				throw new Error(`No reboots found for device ${deviceId}.`)

			if (new Date(reboot.time).getTime() < ts) {
				console.debug(JSON.stringify(reboots))
				throw new Error(`Latest reboot is not newer.`)
			}
			console.debug(`new reboot`, JSON.stringify(reboot))
			await notifier({
				'@context': new URL('https://thingy.rocks/memfault-reboot'),
				deviceId,
				reboot,
			})
		},
		{
			retries: 7,
			minTimeout: 15,
		},
	)
}
