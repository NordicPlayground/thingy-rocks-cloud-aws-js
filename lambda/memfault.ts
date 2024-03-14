import { IoTClient, ListThingsInThingGroupCommand } from '@aws-sdk/client-iot'
import { GetParametersByPathCommand, SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const ssm = new SSMClient({})
const iot = new IoTClient({})
const s3 = new S3Client({})

const { stackName, nrfAssetTrackerStackName, bucket } = fromEnv({
	stackName: 'STACK_NAME',
	nrfAssetTrackerStackName: 'ASSET_TRACKER_STACK_NAME',
	bucket: 'BUCKET',
})(process.env)

const Prefix = `/${stackName}/memfault/`
const { organizationAuthToken, organizationId, projectId } = (
	(
		await ssm.send(
			new GetParametersByPathCommand({
				Path: Prefix,
			}),
		)
	)?.Parameters ?? []
).reduce(
	(params, p) => ({
		...params,
		[(p.Name ?? '').replace(Prefix, '')]: p.Value ?? '',
	}),
	{} as Record<string, string>,
)

if (
	organizationAuthToken === undefined ||
	organizationId === undefined ||
	projectId === undefined
)
	throw new Error(`Memfault settings not configured!`)

type Reboot = {
	type: 'memfault'
	mcu_reason_register: null
	time: string // e.g. '2024-03-14T07:26:37.270000+00:00'
	reason: number // e.g. 7
	software_version: {
		version: string // e.g. '1.11.1+thingy91.low-power.memfault'
		id: number // e.g.504765
		software_type: {
			id: number //e.g. 32069;
			name: string // e.g. 'thingy_world'
		}
		archived: boolean
	}
}

const api = {
	getLastReboots: async (deviceId: string): Promise<null | Array<Reboot>> => {
		const res = await fetch(
			`https://api.memfault.com/api/v0/organizations/${organizationId}/projects/${projectId}/devices/${deviceId}/reboots?${new URLSearchParams(
				{
					since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
				},
			).toString()}`,
			{
				headers: new Headers({
					Authorization: `Basic ${Buffer.from(`:${organizationAuthToken}`).toString('base64')}`,
				}),
			},
		)
		if (!res.ok) return null
		return (await res.json()).data
	},
}

/**
 * Pull data from Memfault about all devices
 */
export const handler = async (): Promise<void> => {
	const { things } = await iot.send(
		new ListThingsInThingGroupCommand({
			thingGroupName: nrfAssetTrackerStackName,
		}),
	)
	const deviceReboots: Record<string, Array<Reboot>> = {}
	for (const thing of things ?? []) {
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
