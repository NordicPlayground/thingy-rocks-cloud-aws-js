import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane'
import { shadowToObjects } from '@hello.nrfcloud.com/proto-map/lwm2m/aws'
import middy from '@middy/core'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { updateShadow } from './updateShadow.ts'

export const iotData = new IoTDataPlaneClient({})

const u = updateShadow(iotData)

export const handler = middy<APIGatewayProxyEventV2, APIGatewayProxyResultV2>(
	async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
		console.log('Request received:', JSON.stringify(event, null, 2))
		console.log('http method:', event.requestContext.http.method)
		if (event.requestContext.http.method === 'POST') {
			try {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				const body = JSON.parse(event.body ?? '{}')
				for (const message of body.messages) {
					if (
						Object.keys(message.message.current.state.reported.lwm2m).length > 0
					) {
						console.log(
							'LwM2M data:',
							message.message.current.state.reported.lwm2m,
						)
						const transformed = shadowToObjects(
							message.message.current.state.reported.lwm2m,
						)
						console.log('Transformed LwM2M data:', transformed)
						const thingName = `${message.teamId}-${message.deviceId}`
						await u(thingName, transformed)
					}
				}
				return {
					statusCode: 200,
					body: JSON.stringify({ message: 'Received' }),
				}
			} catch (err) {
				console.error('Error parsing webhook payload:', err)
				return {
					statusCode: 200,
					body: JSON.stringify({ message: 'Received' }),
				}
			}
		}
		return {
			statusCode: 405,
			body: 'Method Not Allowed',
		}
	},
)
