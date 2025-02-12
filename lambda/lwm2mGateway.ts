import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { IoTClient } from '@aws-sdk/client-iot'
import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane'
import { requestLogger } from '@hello.nrfcloud.com/lambda-helpers/requestLogger'
import {
	senMLtoLwM2M,
	type SenMLType,
} from '@hello.nrfcloud.com/proto-map/senml'
import middy from '@middy/core'
import { fromEnv } from '@nordicsemiconductor/from-env'
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
	.handler(
		async (event: {
			gatewayId: string
			deviceId: string
			timestamp: number
			senML: SenMLType
		}) => {
			const { deviceId, senML, gatewayId } = event

			const maybeObjects = senMLtoLwM2M(senML as any)

			const iotThingName = `${gatewayId}-${deviceId}`

			if ('error' in maybeObjects) {
				console.error(
					`[${iotThingName}]`,
					JSON.stringify(maybeObjects.error.message),
				)
				return
			}

			const objects = maybeObjects.lwm2m
			console.debug(`[${iotThingName}]`, JSON.stringify(maybeObjects))

			if (objects.length === 0) {
				console.debug(`No LwM2M objects found.`)
				return
			}

			await u(iotThingName, objects)

			await notifier({
				'@context': new URL(
					'https://github.com/hello-nrfcloud/proto-map/tree/saga/lwm2m',
				),
				deviceId: iotThingName,
				objects,
			})
		},
	)
