import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { IoTClient } from '@aws-sdk/client-iot'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { Type } from '@sinclair/typebox'
import { LocationSource, notifyClients } from './notifyClients.js'
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
		lat: Type.Number({
			minimum: -90,
			maximum: 90,
			description: 'Global grid line, north to south. Vertical.',
		}),
		lng: Type.Number({
			minimum: -180,
			maximum: 180,
			description: 'Global grid line, east to west. Horizontal.',
		}),
		accuracy: Type.Number({
			minimum: 0,
			description:
				'Radius of the uncertainty circle around the location in meters. Also known as Horizontal Positioning Error (HPE).',
		}),
		unresolved: Type.Literal(false),
		source: Type.Enum(LocationSource),
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
		source: eventSource,
		detail: { input, status },
	} = event
	console.log(JSON.stringify({ event }))
	if (eventSource !== 'aws.states')
		throw new Error(`Unexpected source: ${eventSource}!`)
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

	const { deviceId, lat, lng, accuracy, source } = maybeValid.value

	await notifier({
		deviceId,
		location: {
			lat,
			lng,
			accuracy,
			source,
		},
	})
}
