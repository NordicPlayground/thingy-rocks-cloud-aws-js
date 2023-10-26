import type { KinesisStreamEvent } from 'aws-lambda'
import { parser } from '../nrplus/messageStreamParser.js'

const parserInstance = parser()
parserInstance.onMessage((deviceId, message) => {
	console.log(JSON.stringify({ deviceId, message }))
})

export const handler = async (event: KinesisStreamEvent): Promise<void> => {
	const buffer: Record<string, string[]> = {}
	for (const {
		kinesis: { data, partitionKey },
	} of event.Records) {
		const message = Buffer.from(data, 'base64').toString('utf-8').trim()
		const clientId = partitionKey.split('/')[0] as string // <client id>/nrplus-sink
		if (buffer[clientId] === undefined) {
			buffer[clientId] = [message]
		} else {
			buffer[clientId]?.push(message)
		}
	}

	for (const [clientId, lines] of Object.entries(buffer)) {
		for (const line of lines.sort(ascending))
			parserInstance.addLine(
				clientId,
				// line is prefixed with counter + tab
				line.split('\t', 2)[1] as string,
			)
	}
}

const ascending = (a: string, b: string) => a.localeCompare(b)
