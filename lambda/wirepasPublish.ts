import { randomBytes } from 'crypto'
import mqtt from 'mqtt'
import { SendPacketReq } from '../wirepas-5g-mesh-gateway/protobuf/ts/data_message.js'

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
		sink,
		ledState,
	}: {
		gateway: string
		sink: number
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

		const req: SendPacketReq = {
			qos: 1,
			sourceEndpoint: 1,
			destinationAddress: 1,
			destinationEndpoint: 1,
			payload: Buffer.from([
				129, // LED state set message
				0, // LED identifier (Decimal value 0 is the first user available LED on the node)
				ledState ? 1 : 0, // LED state (Decimal value 0 => switch off, 1 => switch on)
			]),
			header: {
				reqId: BigInt('0x' + randomBytes(8).toString('hex')),
			},
		}

		const topic = `gw-request/send_data/${gateway}/${sink}`

		console.log('Publishing to', topic)
		console.log(
			JSON.stringify(req, (key, value) =>
				typeof value === 'bigint' ? value.toString() : value,
			),
		)

		await new Promise((resolve, reject) => {
			client.publish(
				topic,
				Buffer.from(SendPacketReq.toBinary(req)),
				(err, res) => {
					if (err !== undefined) return reject(err)
					return resolve(res)
				},
			)
		})

		client.end()
	}
