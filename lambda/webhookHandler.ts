import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { IoTClient } from '@aws-sdk/client-iot'
import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane'
import { fromEnv } from '@bifravst/from-env'
import { validateInput } from '@hello.nrfcloud.com/lambda-helpers/validateInput'
import type { LwM2MObjectInstance } from '@hello.nrfcloud.com/proto-map/lwm2m'
import middy from '@middy/core'
import inputOutputLogger from '@middy/input-output-logger'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { ensureThingExists } from '../nordicNRPlus/ensureThingExists.ts'
import {
	inputSchemaLwm2mMessage,
	processNrplusMessagesAndUpdateThingShadow,
} from '../nordicNRPlus/processNrplusMessagesAndUpdateThingShadow.ts'
import { thingExists } from '../nordicNRPlus/thingExists.ts'
import { notifyClients } from './notifyClients.ts'
import { updateShadow } from './updateShadow.ts'
import { withDeviceAlias } from './withDeviceAlias.ts'

export const iotData = new IoTDataPlaneClient({})
const iotClient = new IoTClient({})

const { connectionsTableName, websocketManagementAPIURL } = fromEnv({
	connectionsTableName: 'CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
})(process.env)

const notifier = withDeviceAlias(iotClient)(
	notifyClients({
		db: new DynamoDBClient({}),
		connectionsTableName,
		apiGwManagementClient: new ApiGatewayManagementApi({
			endpoint: websocketManagementAPIURL,
		}),
	}),
)

const u = updateShadow(iotData)
const updateAndNotify = async (
	thingName: string,
	objects: LwM2MObjectInstance[],
): Promise<void> => {
	await u(thingName, objects)
	// A failed push must not fail the webhook: the shadow is already written.
	await notifier({
		'@context': new URL('https://thingy.rocks/lwm2m-update'),
		deviceId: thingName,
		objects,
	}).catch(console.error)
}
const ensureThing = ensureThingExists(iotClient, thingExists)

const handle = processNrplusMessagesAndUpdateThingShadow({
	ensureThing,
	updateShadow: updateAndNotify,
	log: (...args) => console.log('[nordicNRPlusHandler]', ...args),
})

export const handler = middy<APIGatewayProxyEventV2, APIGatewayProxyResultV2>()
	.use(inputOutputLogger())
	.use(validateInput(inputSchemaLwm2mMessage))
	.handler(async (event, context) => {
		if (event.requestContext.http.method !== 'POST') {
			return {
				statusCode: 405,
				body: 'Method Not Allowed',
			}
		}
		await handle(context.decodedInput)
		return {
			statusCode: 200,
		}
	})
