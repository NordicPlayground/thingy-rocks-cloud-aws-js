import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { IoTClient } from '@aws-sdk/client-iot'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { Type } from '@sinclair/typebox'
import { notifyClients } from './notifyClients.js'
import { validateWithTypeBox } from './validateWithTypeBox.js'
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

const validateNetworkSurveyGeoLocation = validateWithTypeBox(
	Type.Object({
		deviceId: Type.String({ minLength: 1 }),
		networksurveygeo: Type.Object({
			lat: Type.Number({ minimum: 1 }),
			lng: Type.Number({ minimum: 1 }),
			accuracy: Type.Integer({ minimum: 1 }),
			located: Type.Literal(true),
		}),
	}),
)

export const handler = async (event: {
	source: string
	detail: {
		status: 'SUCCEEDED' | 'FAILED' // 'SUCCEEDED'
		output: string
	}
}): Promise<void> => {
	const {
		source,
		detail: { status, output },
	} = event
	console.log(JSON.stringify({ event }))
	if (source !== 'aws.states') throw new Error(`Unexpected source: ${source}!`)
	if (status !== 'SUCCEEDED') throw new Error(`Unexpected status: ${status}!`)
	const result = JSON.parse(output)

	const maybeValid = validateNetworkSurveyGeoLocation(result)
	if ('errors' in maybeValid) {
		console.error(JSON.stringify(maybeValid.errors))
		throw new Error(`Unexpected result: ${result}`)
	}

	const {
		deviceId,
		networksurveygeo: { lat, lng, accuracy },
	} = maybeValid.value

	await notifier({
		deviceId,
		location: {
			lat,
			lng,
			accuracy,
			source: 'network',
		},
	})
}
