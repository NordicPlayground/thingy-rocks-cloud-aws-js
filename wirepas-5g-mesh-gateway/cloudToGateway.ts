import { mqtt, io, iot, iotshadow } from 'aws-iot-device-sdk-v2'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
	UpdateThingShadowCommand,
	type IoTDataPlaneClient,
} from '@aws-sdk/client-iot-data-plane'

io.enable_logging(
	process.env.AWS_IOT_SDK_LOG_LEVEL === undefined
		? io.LogLevel.ERROR
		: parseInt(process.env.AWS_IOT_SDK_LOG_LEVEL, 10),
)
const clientBootstrap = new io.ClientBootstrap()

const connect = async ({
	clientCert,
	privateKey,
	deviceId,
	mqttEndpoint,
	log,
}: {
	clientCert: string
	privateKey: string
	deviceId: string
	mqttEndpoint: string

	log: {
		debug: (...args: any[]) => void
		error: (...args: any[]) => void
	}
}) =>
	new Promise<mqtt.MqttClientConnection>((resolve, reject) => {
		const cfg = iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder(
			clientCert,
			privateKey,
		)
		cfg.with_clean_session(true)
		cfg.with_client_id(deviceId)
		cfg.with_endpoint(mqttEndpoint)
		const client = new mqtt.MqttClient(clientBootstrap)
		const connection = client.new_connection(cfg.build())
		connection.on('error', (err) => {
			log.error(JSON.stringify(err))
			reject(err)
		})
		connection.on('connect', () => {
			log.debug(`${deviceId} connected`)
			resolve(connection)
		})
		connection.on('disconnect', () => {
			log.debug(`${deviceId} disconnected`)
		})
		connection.on('closed', () => {
			log.debug(`${deviceId} closed`)
		})
		connection.connect().catch(() => {
			log.debug(`${deviceId} failed to connect.`)
		})
	})

type Desired = {
	nodes: Record<
		string,
		{ payload: { led?: { r?: boolean; g?: boolean; b?: boolean } } }
	>
}

export const cloudToGateway =
	(
		iotDataClient: IoTDataPlaneClient,
		log: {
			debug: (...args: any[]) => void
			error: (...args: any[]) => void
		},
	) =>
	async (
		deviceId: string,
		onDesired: (desired: Desired) => Promise<void>,
	): Promise<mqtt.MqttClientConnection> => {
		const [privateKey, clientCert] = [
			readFileSync(
				path.join(process.cwd(), 'certificates', `${deviceId}-private.pem.key`),
				'utf-8',
			),
			[
				readFileSync(
					path.join(
						process.cwd(),
						'certificates',
						`${deviceId}-certificate.pem.crt`,
					),
					'utf-8',
				),
				readFileSync(
					path.join(process.cwd(), 'certificates', `AmazonRootCA1.pem`),
					'utf-8',
				),
			].join(os.EOL),
		]
		const connection = await connect({
			clientCert,
			privateKey,
			deviceId,
			mqttEndpoint: 'iot.thingy.rocks',
			log,
		})
		const shadow = new iotshadow.IotShadowClient(connection)

		void shadow.subscribeToShadowDeltaUpdatedEvents(
			{
				thingName: deviceId,
			},
			mqtt.QoS.AtLeastOnce,
			async (err, response) => {
				if (err !== undefined) {
					log.error(err)
				}
				const desired = (response?.state ?? {}) as Desired
				log.debug(JSON.stringify(desired))
				await onDesired(desired)
				await iotDataClient.send(
					new UpdateThingShadowCommand({
						thingName: deviceId,
						payload: JSON.stringify({
							state: {
								reported: desired,
							},
						}),
					}),
				)
			},
		)

		return connection
	}
