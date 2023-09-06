import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { Type } from '@sinclair/typebox'
import { LocationSource, Network, notifyClients } from './notifyClients.js'
import { validateWithTypeBox } from './validateWithTypeBox.js'

const { connectionsTableName, websocketManagementAPIURL } = fromEnv({
	connectionsTableName: 'CONNECTIONS_TABLE_NAME',
	websocketManagementAPIURL: 'WEBSOCKET_MANAGEMENT_API_URL',
})(process.env)

const db = new DynamoDBClient({})
const apiGwManagementClient = new ApiGatewayManagementApi({
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
			located: Type.Literal(true),
			source: Type.Enum(LocationSource),
		}),
	}),
)

export const handler = async (event: {
	source: string //'aws.states'
	detail: {
		status: 'SUCCEEDED' | 'FAILED' // 'SUCCEEDED'
		output: string //'{"area":30401,"cell":21679616,"mccmnc":24201,"nw":"ltem","cellgeo":{"lat":63.419001,"lng":10.437035,"accuracy":500,"located":true,"source":"nrfcloud"},"storedInCache":true}'
	}
}): Promise<void> => {
	const {
		source: eventSource,
		detail: { status, output },
	} = event
	console.log(JSON.stringify({ event }))
	if (eventSource !== 'aws.states')
		throw new Error(`Unexpected source: ${eventSource}!`)
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
		cellgeo: { lat, lng, accuracy, source },
	} = maybeValid.value

	await notifier({
		cellGeoLocation: {
			cell: {
				area,
				cell,
				mccmnc,
				nw: nw === Nw.nbIoT ? Network.nbIoT : Network.lteM,
			},
			geoLocation: { lat, lng, accuracy, source },
		},
	})
}
