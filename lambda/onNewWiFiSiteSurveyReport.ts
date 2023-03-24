import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { AttributeValue, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { IoTClient } from '@aws-sdk/client-iot'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import type { DynamoDBStreamEvent } from 'aws-lambda'
import {
	getActiveConnections,
	notifyClients,
	type GeoLocation,
} from './notifyClients.js'
import { withDeviceAlias } from './withDeviceAlias.js'

const {
	connectionsTableName,
	websocketManagementAPIURL,
	wiFiSiteSurveyGeolocationApiUrl,
} = fromEnv({
	connectionsTableName: 'CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
	wiFiSiteSurveyGeolocationApiUrl: 'WIFISITESURVEY_API_URL',
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

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
	console.log(JSON.stringify({ event, wiFiSiteSurveyGeolocationApiUrl }))

	const connectionIds: string[] = await getActiveConnections(
		db,
		connectionsTableName,
	)
	if (connectionIds.length === 0) {
		console.log(`No clients to notify.`)
		return
	}

	for (const { dynamodb, eventName } of event.Records) {
		if (eventName === 'REMOVE') continue
		const NewImage = dynamodb?.NewImage
		if (NewImage === undefined) continue
		const survey = unmarshall(NewImage as Record<string, AttributeValue>)
		console.log({ survey })
		const { surveyId, unresolved, deviceId, lat, lng, accuracy, inProgress } =
			survey

		if (inProgress === true) continue

		if (lat !== undefined) {
			console.log(
				`Geo location resolved for survey ${surveyId} from device ${deviceId}.`,
				{
					lat,
					lng,
					accuracy,
				},
			)
			await notifier({
				deviceId,
				location: { lat, lng, accuracy, source: 'wifi' },
			})
			return
		}

		if (unresolved === false) {
			console.log(
				`No geo location resolved for survey ${surveyId} from device ${deviceId}.`,
			)
			return
		}

		console.log(`Resolving survey ${surveyId} from device ${deviceId}...`)
		const res = await fetch(`${wiFiSiteSurveyGeolocationApiUrl}${surveyId}`)

		const textBody = await res.text()
		let body: Record<string, any> | undefined = undefined
		try {
			body = JSON.parse(textBody)
		} catch {
			console.error(`Failed to parse body as JSON`, textBody)
		}

		switch (res.status) {
			case 409:
				console.log(`Processing ...`)
				break
			case 200:
				await notifier({
					deviceId,
					location: { ...((body ?? {}) as GeoLocation), source: 'wifi' },
				})
				break
			default:
				console.error(textBody)
				throw new Error(`Request failed!`)
		}
	}
}
