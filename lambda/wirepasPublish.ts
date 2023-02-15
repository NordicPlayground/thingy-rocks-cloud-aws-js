import { randomBytes } from 'crypto'
import mqtt from 'mqtt'
import { GenericMessage } from '../wirepas-5g-mesh-gateway/protobuf/ts/generic_message.js'

/**
 * Publish a message to the Wirepas 5G Mesh Gateway
 * @see https://github.com/wirepas/backend-apis/tree/v1.4.0/gateway_to_backend#data-module
 *
 * Right now only the LED state is supported
 * @see https://github.com/wirepas/wm-sdk/tree/v1.4.0/source/example_apps/evaluation_app#led-state-set-message
 */
export const wirepasPublish =
	({ gatewayMqttEndpoint }: { gatewayMqttEndpoint: string }) =>
	async ({
		gateway,
		node,
		ledState,
	}: {
		gateway: string
		node: number
		ledState: boolean
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

		const req: GenericMessage = {
			wirepas: {
				sendPacketReq: {
					qos: 2, // send the downlink messages (i.e from backend to nodes) with MQTT QoS 2 so that they are delivered only once to the gateway.
					sourceEndpoint: 1,
					destinationAddress: node,
					destinationEndpoint: 1,
					payload: Buffer.from([
						// LED state set message
						129,
						// LED identifier (Decimal value 0 is the first user available LED on the node)
						// FIXME: change to 5 later
						// For now keep the LED ID as “0” (current boards do not manage this but for the demo it will be “5”.
						0,
						// LED state (Decimal value 0 => switch off, 1 => switch on)
						ledState ? 1 : 0,
					]),
					header: {
						reqId: BigInt('0x' + randomBytes(8).toString('hex')),
					},
				},
			},
		}

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
