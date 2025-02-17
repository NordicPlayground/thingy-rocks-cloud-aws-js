import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { IoTClient } from '@aws-sdk/client-iot'
import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane'
import { requestLogger } from '@hello.nrfcloud.com/lambda-helpers/requestLogger'
import { LwM2MObjectID } from '@hello.nrfcloud.com/proto-map/lwm2m'
import middy from '@middy/core'
import { fromEnv } from '@nordicsemiconductor/from-env'
import type { SQSEvent } from 'aws-lambda'
import { findLwM2MObject } from '../ntn-udp-payload/isNotEmpty.ts'
import { parse } from '../ntn-udp-payload/parse.ts'
import { notifyClients } from './notifyClients.ts'
import { updateShadow } from './updateShadow.ts'
import { withDeviceAlias } from './withDeviceAlias.ts'

const db = new DynamoDBClient({})
const iotData = new IoTDataPlaneClient({})
const iot = new IoTClient({})

const u = updateShadow(iotData)

const { connectionsTableName, websocketManagementAPIURL } = fromEnv({
	connectionsTableName: 'CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
})(process.env)

const apiGwManagementClient = new ApiGatewayManagementApi({
	endpoint: websocketManagementAPIURL,
})

const notifier = withDeviceAlias(iot)(
	notifyClients({
		db,
		connectionsTableName,
		apiGwManagementClient,
	}),
)

export const handler = middy()
	.use(requestLogger())
	.handler(async (event: SQSEvent) => {
		for (const record of event.Records) {
			const maybeLwM2M = parse(record.body)
			if (maybeLwM2M.length === 0) {
				console.debug(`Failed to parse record: ${record.body}`)
				continue
			}

			const deviceInfo = findLwM2MObject(
				maybeLwM2M,
				LwM2MObjectID.DeviceInformation_14204,
			)
			if (deviceInfo === undefined) {
				console.debug(`Failed to parse device info from: ${record.body}`)
				continue
			}

			const iotThingName = `ntn-udp-${deviceInfo.Resources[0] as string}`
			await notifier({
				'@context': new URL('https://thingy.rocks/lwm2m-update'),
				deviceId: iotThingName,
				objects: maybeLwM2M,
			})

			await u(iotThingName, maybeLwM2M)
		}
	})
