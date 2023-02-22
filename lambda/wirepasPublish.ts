import { randomBytes } from 'crypto'
import mqtt from 'mqtt'
import { GenericMessage } from '../wirepas-5g-mesh-gateway/protobuf/ts/generic_message.js'

// https://github.com/wirepas/wm-sdk/tree/v1.4.0/source/example_apps/evaluation_app
enum ExampleAppMessages {
	LED_STATE_SET = 192,
	LED_STATE_GET = 130,
}

// FIXME: change to 5 later
// For now keep the LED ID as “0” (current boards do not manage this but for the demo it will be “5”.
const LED_ID = 0

const sendPacket = (node: number, payload: Buffer): GenericMessage => ({
	wirepas: {
		sendPacketReq: {
			qos: 2, // send the downlink messages (i.e from backend to nodes) with MQTT QoS 2 so that they are delivered only once to the gateway.
			sourceEndpoint: 1,
			destinationAddress: node,
			destinationEndpoint: 1,
			payload,
			header: {
				reqId: BigInt('0x' + randomBytes(8).toString('hex')),
			},
		},
	},
})

/**
 * Turns on an LED
 *
 * @see https://github.com/wirepas/wm-sdk/tree/v1.4.0/source/example_apps/evaluation_app#led-state-set-message
 */
export const turnOnLed = ({
	node,
	ledState,
}: {
	node: number
	ledState: boolean
}): GenericMessage =>
	sendPacket(
		node,
		Buffer.from([
			// LED state set message
			ExampleAppMessages.LED_STATE_SET,
			// LED identifier (Decimal value 0 is the first user available LED on the node)
			LED_ID,
			// LED state (Decimal value 0 => switch off, 1 => switch on)
			ledState ? 1 : 0,
		]),
	)

/**
 * Query LED state
 *
 * @see https://github.com/wirepas/wm-sdk/tree/v1.4.0/source/example_apps/evaluation_app#led-state-get-request-message
 */
export const getLedState = ({ node }: { node: number }): GenericMessage =>
	sendPacket(
		node,
		Buffer.from([
			// LED state set message
			ExampleAppMessages.LED_STATE_GET,
			// LED identifier (Decimal value 0 is the first user available LED on the node)
			LED_ID,
		]),
	)

/**
 * Publish a message to the Wirepas 5G Mesh Gateway
 * @see https://github.com/wirepas/backend-apis/tree/v1.4.0/gateway_to_backend#data-module

 */
export const wirepasPublish =
	({ gatewayMqttEndpoint }: { gatewayMqttEndpoint: string }) =>
	async ({
		gateway,
		req,
	}: {
		gateway: string
		req: GenericMessage
	}): Promise<void> => {
		const client = await new Promise<mqtt.MqttClient>((resolve, reject) => {
			const t = setTimeout(() => {
				reject(
					new Error(
						`Time out reached connecting to ${
							new URL(gatewayMqttEndpoint).hostname
						}`,
					),
				)
			}, 30 * 1000)
			const client = mqtt.connect(gatewayMqttEndpoint)

			client.on('connect', () => {
				console.log(`[MQTT]`, `Connected.`)
				clearTimeout(t)
				resolve(client)
			})
		})

		const topic = `gw-request/send_data/${gateway}/sink1`

		console.log('Publishing to', topic)
		console.log(
			JSON.stringify(req, (key, value) =>
				typeof value === 'bigint' ? value.toString() : value,
			),
		)

		await new Promise((resolve, reject) => {
			client.publish(
				topic,
				Buffer.from(GenericMessage.toBinary(req)),
				(err, res) => {
					if (err !== undefined) return reject(err)
					return resolve(res)
				},
			)
		})

		client.end()
	}
