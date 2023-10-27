import type { KinesisStreamEvent } from 'aws-lambda'
import { parser } from '../nrplus/messageStreamParser.js'
import { PCCLines, PDCLines, isPCCInfo, isPDCInfo } from '../nrplus/messages.js'
import {
	IoTDataPlaneClient,
	UpdateThingShadowCommand,
} from '@aws-sdk/client-iot-data-plane'

const buttonPressRegExp = /Button ([0-9]+) pressed/

const iotData = new IoTDataPlaneClient({})

const updateNodeData = async (
	deviceId: string,
	nodeId: string,
	data: Record<string, unknown>,
) => {
	void iotData.send(
		new UpdateThingShadowCommand({
			thingName: deviceId,
			payload: Buffer.from(
				JSON.stringify({
					state: {
						reported: {
							nodes: {
								[nodeId]: data,
							},
						},
					},
				}),
			),
		}),
	)
}

const parserInstance = parser([PCCLines, PDCLines])
parserInstance.onMessage((deviceId, message) => {
	console.log(JSON.stringify({ deviceId, message }))
	if (isPCCInfo(message)) {
		void iotData.send(
			new UpdateThingShadowCommand({
				thingName: deviceId,
				payload: Buffer.from(
					JSON.stringify({
						state: {
							reported: {
								id: parseFloat(message.receiverId),
								networkId: parseFloat(message.networkId),
								nodes: {
									[message.transmitterId]: {
										txPowerDBm: parseFloat(message.txPowerDBm),
									},
								},
							},
						},
					}),
				),
			}),
		)
	} else if (isPDCInfo(message)) {
		const buttonPressed = buttonPressRegExp.exec(message.sduData)
		if (buttonPressed !== null) {
			void updateNodeData(deviceId, message.transmitterId, {
				btn: parseInt(buttonPressed[1] ?? '1', 10),
			})
		} else {
			try {
				const { m_tmp } = JSON.parse(message.sduData)
				void updateNodeData(deviceId, message.transmitterId, {
					temp: parseInt(m_tmp, 10),
				})
			} catch {
				console.error(`Failed to parse payload "${message.sduData}" as JSON.`)
			}
		}
	}
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
