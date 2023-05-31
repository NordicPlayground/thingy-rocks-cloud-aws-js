import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { IoTClient } from '@aws-sdk/client-iot'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { Type } from '@sinclair/typebox'
import { notifyClients } from './notifyClients.js'
import { validateWithTypeBox } from './validateWithTypeBox.js'
import { withDeviceAlias } from './withDeviceAlias.js'

const { connectionsTableName, websocketManagementAPIURL, surveysTableName } =
	fromEnv({
		connectionsTableName: 'CONNECTIONS_TABLE_NAME',
		websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
		surveysTableName: 'NETWORK_SURVEY_TABLE_NAME',
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

const validateNetworkSurveyWithGeoLocation = validateWithTypeBox(
	Type.Object({
		deviceId: Type.String({ minLength: 1 }),
		lat: Type.Number({ minimum: 1 }),
		lng: Type.Number({ minimum: 1 }),
		accuracy: Type.Number({ minimum: 1 }),
		unresolved: Type.Literal(false),
	}),
)

export const handler = async (event: {
	source: string
	detail: {
		status: 'SUCCEEDED' | 'FAILED' // 'SUCCEEDED'
		name: string // surveyId
		input: string
	}
}): Promise<void> => {
	const {
		source,
		detail: { input, status },
	} = event
	console.log(JSON.stringify({ event }))
	if (source !== 'aws.states') throw new Error(`Unexpected source: ${source}!`)
	if (status !== 'SUCCEEDED') throw new Error(`Unexpected status: ${status}!`)
	const surveyId = JSON.parse(input).surveyId

	const { Item } = await db.send(
		new GetItemCommand({
			TableName: surveysTableName,
			Key: {
				surveyId: {
					S: surveyId,
				},
			},
		}),
	)
	if (Item === undefined) throw new Error(`Survey not found: ${name}!`)

	const survey = unmarshall(Item)

	const maybeValid = validateNetworkSurveyWithGeoLocation(survey)
	if ('errors' in maybeValid) {
		console.error(JSON.stringify(maybeValid.errors))
		throw new Error(`Unexpected result: ${JSON.stringify(survey)}`)
	}

	const { deviceId, lat, lng, accuracy } = maybeValid.value

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
