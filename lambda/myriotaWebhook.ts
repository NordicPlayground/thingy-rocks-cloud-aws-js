import { IoTClient } from '@aws-sdk/client-iot'
import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane'
import middy from '@middy/core'
import inputOutputLogger from '@middy/input-output-logger'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { findThingByMyriotaDeviceId } from '../myriota/findThingByMyriotaDeviceId.ts'
import {
	parseMyriotaData,
	parseMyriotaPacketValue,
} from '../myriota/parseMyriotaData.ts'
import {
	fetchCertificateCached,
	MyriotaMessage,
	verifyMyriotaMessage,
} from '../myriota/verifyMyriotaMessage.ts'
import { updateShadow } from './updateShadow.ts'
import { validateWithTypeBox } from './validateWithTypeBox.ts'

const verify = verifyMyriotaMessage(fetchCertificateCached())
const validate = validateWithTypeBox(MyriotaMessage)
const findThing = findThingByMyriotaDeviceId(new IoTClient({}))
const u = updateShadow(new IoTDataPlaneClient({}))

/**
 * Receives messages from the Myriota Device Manager
 *
 * @see https://support.myriota.com/hc/en-us/articles/6482340814351-HTTP
 */
export const handler = middy<APIGatewayProxyEventV2, APIGatewayProxyResultV2>()
	.use(inputOutputLogger())
	.handler(async (event) => {
		if (event.requestContext.http.method !== 'POST')
			return { statusCode: 405, body: 'Method Not Allowed' }

		let body: unknown
		try {
			body = JSON.parse(
				event.isBase64Encoded === true
					? Buffer.from(event.body ?? '', 'base64').toString('utf-8')
					: (event.body ?? ''),
			)
		} catch {
			console.error('[myriota]', 'Invalid JSON', event.body)
			return { statusCode: 400, body: 'Invalid JSON' }
		}

		const maybeValid = validate(body)
		if ('errors' in maybeValid) {
			console.error(
				'[myriota]',
				'Invalid message',
				JSON.stringify(maybeValid.errors),
			)
			return { statusCode: 400, body: 'Invalid message' }
		}
		const message = maybeValid.value

		const res = await verify(message)
		if (!res.verified) {
			console.error(
				'[myriota]',
				'Verification failed',
				res.error,
				JSON.stringify(message),
			)
			return { statusCode: 403, body: 'Forbidden' }
		}

		const maybeData = parseMyriotaData(message.Data)
		if ('error' in maybeData) {
			console.error('[myriota]', 'Invalid data', maybeData.error.message)
			return { statusCode: 400, body: 'Invalid data' }
		}

		for (const packet of maybeData.packets) {
			const maybeLwM2M = parseMyriotaPacketValue(packet.Value)
			if ('error' in maybeLwM2M) {
				console.error(
					'[myriota]',
					'Failed to parse packet',
					maybeLwM2M.error.message,
					JSON.stringify(packet),
				)
				continue
			}
			const thingName = await findThing(packet.TerminalId)
			if (thingName === null) {
				console.error(
					'[myriota]',
					'No thing found for Myriota device',
					packet.TerminalId,
				)
				continue
			}
			console.debug('[myriota]', thingName, JSON.stringify(maybeLwM2M.lwm2m))
			await u(thingName, maybeLwM2M.lwm2m)
		}

		return { statusCode: 202 }
	})
