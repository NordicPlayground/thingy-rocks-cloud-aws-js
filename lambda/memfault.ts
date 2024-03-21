import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { IoTClient } from '@aws-sdk/client-iot'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { listThingsInGroup } from './listThingsInGroup.js'
import { createAPIClient, type Reboot } from './memfault/api.js'
import { getActiveConnections } from './notifyClients.js'

export const ssm = new SSMClient({})
const iot = new IoTClient({})
const s3 = new S3Client({})
const db = new DynamoDBClient({})

const { stackName, nrfAssetTrackerStackName, bucket, connectionsTableName } =
	fromEnv({
		stackName: 'STACK_NAME',
		nrfAssetTrackerStackName: 'ASSET_TRACKER_STACK_NAME',
		bucket: 'BUCKET',
		connectionsTableName: 'CONNECTIONS_TABLE_NAME',
	})(process.env)

const getActive = getActiveConnections(db, connectionsTableName)

const api = await createAPIClient(ssm, stackName)

const listThings = listThingsInGroup(iot)

/**
 * Pull data from Memfault about all devices
 */
export const handler = async (): Promise<void> => {
	if ((await getActive()).length === 0) {
		console.debug('No active connections.')
		return
	}

	const deviceReboots: Record<string, Array<Reboot>> = {}
	for (const thing of await listThings(nrfAssetTrackerStackName)) {
		const reboots = await api.getLastReboots(thing)
		if (reboots === null) {
			console.debug(thing, `No data found.`)
			continue
		}
		if (reboots.length === 0) {
			console.debug(thing, `No reboots in the last 24 hours.`)
			continue
		}
		deviceReboots[thing] = reboots
		console.debug(thing, `Updated`)
	}

	await s3.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: 'device-reboots.json',
			ContentType: 'application/json',
			CacheControl: 'public, max-age=300',
			Body: JSON.stringify({
				'@context':
					'https://github.com/NordicPlayground/thingy-rocks-cloud-aws-js/Memfault/reboots',
				reboots: deviceReboots,
			}),
		}),
	)
}
