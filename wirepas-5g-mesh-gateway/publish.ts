import { randomBytes } from 'crypto'
import mqtt from 'mqtt'
import { GenericMessage } from '../wirepas-5g-mesh-gateway/protobuf/ts/generic_message.js'

// https://github.com/wirepas/wm-sdk/tree/v1.4.0/source/example_apps/evaluation_app
enum ExampleAppMessages {
	LED_STATE_SET = 129,
	LED_STATE_GET = 130,
}

export enum LED_COLOR {
	RED = 0,
	BLUE = 1,
	GREEN = 2,
	ALL = 255,
}

// LED state (Decimal value 0 => switch off, 1 => switch on)
export enum LED_STATE {
	OFF = 0,
	ON = 1,
}

const sendPacket = (node: number, payload: Buffer): GenericMessage => ({
	wirepas: {
		sendPacketReq: {
			qos: 2, // send the downlink messages (i.e from backend to nodes) with MQTT QoS 2 so that they are delivered only once to the gateway.
			sourceEndpoint: 0x10,
			destinationAddress: node,
			destinationEndpoint: 0x41,
			payload,
			header: {
				reqId: BigInt('0x' + randomBytes(8).toString('hex')),
			},
		},
	},
})

/**
 * Controls an LED
 *
 * On this version, we can drive red, blue, green and all three user LED (respectively with color code 00, 01, 02 and FF) and its state (on: 01, off: 00).
 * Therefore, the full command is 81 [color] [state] (3 bytes).
 *
 * @see https://github.com/wirepas/wm-sdk/tree/v1.4.0/source/example_apps/evaluation_app#led-state-set-message
 */
export const setLEDColor = ({
	node,
	color,
	ledState,
}: {
	node: number
	color: LED_COLOR
	ledState: LED_STATE
}): GenericMessage =>
	sendPacket(
		node,
		Buffer.from([ExampleAppMessages.LED_STATE_SET, color, ledState]),
	)

/**
 * Query LED state
 *
 * @see https://github.com/wirepas/wm-sdk/tree/v1.4.0/source/example_apps/evaluation_app#led-state-get-request-message
 */
export const getLedState = ({
	node,
	color,
}: {
	node: number
	color: LED_COLOR
}): GenericMessage =>
	sendPacket(node, Buffer.from([ExampleAppMessages.LED_STATE_GET, color]))

/**
 * Publish a message to the Wirepas 5G Mesh Gateway
 * @see https://github.com/wirepas/backend-apis/tree/v1.4.0/gateway_to_backend#data-module

 */
export const wirepasPublish =
	({
		client,
		debug,
	}: {
		client: mqtt.MqttClient
		debug: (...args: any[]) => unknown
	}) =>
	async ({
		gateway,
		req,
	}: {
		gateway: string
		req: GenericMessage
	}): Promise<void> => {
		const topic = `gw-request/send_data/${gateway}/sink1`

		debug('Publishing to', topic)
		debug(
			JSON.stringify(req, (key, value): any =>
				// eslint-disable-next-line @typescript-eslint/no-unsafe-return
				typeof value === 'bigint' ? value.toString() : value,
			),
		)

		await new Promise((resolve, reject) => {
			client.publish(
				topic,
				Buffer.from(GenericMessage.toBinary(req)),
				{ qos: 1 },
				(err, res) => {
					if (err !== undefined && err !== null) return reject(err)
					return resolve(res)
				},
			)
		})
	}
