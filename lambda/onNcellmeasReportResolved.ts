import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { Type } from '@sinclair/typebox'
import { notifyClients } from './notifyClients.js'
import { validateWithTypeBox } from './validateWithTypeBox.js'

const { connectionsTableName, websocketManagementAPIURL } = fromEnv({
	connectionsTableName: 'CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
})(process.env)

const db = new DynamoDBClient({})
export const apiGwManagementClient = new ApiGatewayManagementApi({
	endpoint: websocketManagementAPIURL,
})
const notifier = notifyClients({
	db,
	connectionsTableName,
	apiGwManagementClient,
})

const validateNcellmeasGeoLocation = validateWithTypeBox(
	Type.Object({
		deviceId: Type.String({ minLength: 1 }),
		ncellmeasgeo: Type.Object({
			lat: Type.Number({ minimum: 1 }),
			lng: Type.Number({ minimum: 1 }),
			accuracy: Type.Integer({ minimum: 1 }),
			located: Type.Literal(true),
		}),
	}),
)

export const handler = async (event: {
	source: string //'aws.states'
	detail: {
		status: 'SUCCEEDED' | 'FAILED' // 'SUCCEEDED'
		output: string //'{"reportId":"6dc3c5a2-7147-474f-a6d0-d86ea36935af","deviceId":"351358811128484","timestamp":"2022-12-09T13:08:53.500Z","report":{"area":30401,"adv":82,"nmr":[{"rsrp":-107,"cell":195,"rsrq":-12,"earfcn":300},{"rsrp":-67,"cell":468,"rsrq":-6,"earfcn":1450}],"mnc":1,"rsrq":-9,"rsrp":-78,"mcc":242,"cell":21679616,"earfcn":6400,"ts":1670591327535},"nw":"LTE-M","ncellmeasgeo":{"lat":63.419001,"lng":10.437035,"accuracy":500,"located":true,"source":"nrfcloud"},"persisted":true}'
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

	const maybeValid = validateNcellmeasGeoLocation(result)
	if ('errors' in maybeValid) {
		console.error(JSON.stringify(maybeValid.errors))
		throw new Error(`Unexpected result: ${result}`)
	}

	const {
		deviceId,
		ncellmeasgeo: { lat, lng, accuracy },
	} = maybeValid.value

	await notifier({
		deviceId,
		location: {
			lat,
			lng,
			accuracy,
			source: 'multi-cell',
		},
	})
}
