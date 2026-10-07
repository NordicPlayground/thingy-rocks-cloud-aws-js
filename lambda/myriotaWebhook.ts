import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import {
	fetchCertificateCached,
	MyriotaMessage,
	verifyMyriotaMessage,
} from '../myriota/verifyMyriotaMessage.ts'
import { validateWithTypeBox } from './validateWithTypeBox.ts'

const verify = verifyMyriotaMessage(fetchCertificateCached())
const validate = validateWithTypeBox(MyriotaMessage)

const parseData = (data: string): unknown => {
	try {
		return JSON.parse(data) as unknown
	} catch {
		return data
	}
}

/**
 * Receives messages from the Myriota Device Manager
 *
 * @see https://support.myriota.com/hc/en-us/articles/6482340814351-HTTP
 */
export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
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

	console.log(
		'[myriota]',
		JSON.stringify({
			EndpointRef: message.EndpointRef,
			Timestamp: message.Timestamp,
			Id: message.Id,
			Data: parseData(message.Data),
		}),
	)

	return { statusCode: 202 }
}
