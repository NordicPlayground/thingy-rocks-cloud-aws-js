import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { Type } from '@sinclair/typebox'
import { Network, notifyClients } from './notifyClients.js'
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

enum Nw {
	lteM = 'ltem',
	nbIoT = 'nbiot',
}

const validateCellGeoLocation = validateWithTypeBox(
	Type.Object({
		area: Type.Integer({ minimum: 1 }),
		cell: Type.Integer({ minimum: 1 }),
		mccmnc: Type.Integer({ minimum: 1 }),
		nw: Type.Enum(Nw),
		cellgeo: Type.Object({
			lat: Type.Number({ minimum: 1 }),
			lng: Type.Number({ minimum: 1 }),
			accuracy: Type.Integer({ minimum: 1 }),
			located: Type.Literal(true),
		}),
	}),
)

export const handler = async (event: {
	version: string //'0'
	id: string //'e3c73557-c877-3318-e97d-b81b349a46bd'
	'detail-type': string //'Step Functions Execution Status Change'
	source: string //'aws.states'
	account: string //'374216331074'
	time: string //'2022-11-30T14:50:34Z'
	region: string //'eu-central-1'
	resources: string[] //['arn:aws:states:eu-central-1:374216331074:execution:nrf-asset-tracker-cellGeo:3c422dc3-84aa-4ab4-abb1-969714b09232',]
	detail: {
		executionArn: string // 'arn:aws:states:eu-central-1:374216331074:execution:nrf-asset-tracker-cellGeo:3c422dc3-84aa-4ab4-abb1-969714b09232'
		stateMachineArn: string // 'arn:aws:states:eu-central-1:374216331074:stateMachine:nrf-asset-tracker-cellGeo'
		name: string // '3c422dc3-84aa-4ab4-abb1-969714b09232'
		status: 'SUCCEEDED' | 'FAILED' // 'SUCCEEDED'
		startDate: number // 1669819829585
		stopDate: number // 1669819834065
		input: string //'{"area":30401,"cell":21679616,"mccmnc":24201,"nw":"ltem"}'
		output: string //'{"area":30401,"cell":21679616,"mccmnc":24201,"nw":"ltem","cellgeo":{"lat":63.419001,"lng":10.437035,"accuracy":500,"located":true,"source":"nrfcloud"},"storedInCache":true}'
		inputDetails: {
			included: boolean //true
		}
		outputDetails: {
			included: boolean //true
		}
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

	const maybeValid = validateCellGeoLocation(result)
	if ('errors' in maybeValid) {
		console.error(JSON.stringify(maybeValid.errors))
		throw new Error(`Unexpected result: ${result}`)
	}

	const {
		area,
		cell,
		mccmnc,
		nw,
		cellgeo: { lat, lng, accuracy },
	} = maybeValid.value

	await notifier({
		cellGeoLocation: {
			cell: {
				area,
				cell,
				mccmnc,
				nw: nw === Nw.nbIoT ? Network.nbIoT : Network.lteM,
			},
			geoLocation: { lat, lng, accuracy },
		},
	})
}
