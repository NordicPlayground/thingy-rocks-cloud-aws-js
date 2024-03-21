import { IoTClient } from '@aws-sdk/client-iot'
import { fetchLwM2MShadows } from '../lwm2m/fetchLwM2MShadows.js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { models } from '@hello.nrfcloud.com/proto-map'

const iot = new IoTClient({})
const fetchShadows = fetchLwM2MShadows(iot)
const s3 = new S3Client({})
const { bucket } = fromEnv({ bucket: 'BUCKET' })(process.env)

export const handler = async (): Promise<void> => {
	await s3.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: 'lwm2m-shadows.json',
			ContentType: 'application/json',
			CacheControl: 'public, max-age=60',
			Body: JSON.stringify({
				'@context': 'https://github.com/hello-nrfcloud/proto/map/devices',
				devices: (await fetchShadows(30)).map(({ deviceId, objects }) => ({
					'@context': 'https://github.com/hello-nrfcloud/proto/map/device',
					id: deviceId,
					model: models['asset_tracker_v2+AWS'].id,
					state: objects,
				})),
			}),
		}),
	)
}
