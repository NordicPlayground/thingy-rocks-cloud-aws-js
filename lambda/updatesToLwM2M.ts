import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane'
import { transformShadowUpdateToLwM2M } from '../lwm2m/transformShadowUpdateToLwM2M.ts'
import { Asset_tracker_v2_AWS } from '../proto-asset_tracker_v2+AWS/transforms.ts'
import { updateShadow } from './updateShadow.ts'

export const iotData = new IoTDataPlaneClient({})
const transformUpdate = transformShadowUpdateToLwM2M(
	Asset_tracker_v2_AWS.transforms,
)

const u = updateShadow(iotData)

/**
 * Store shadow updates in asset_tracker_v2 shadow format as LwM2M objects in a named shadow.
 */
export const handler = async (event: {
	deviceId: string
	update: {
		state: {
			reported?: Record<string, unknown>
			desired?: Record<string, unknown>
		}
	}
}): Promise<void> => {
	console.debug(JSON.stringify({ event }))
	const { deviceId, update } = event
	const objects = await transformUpdate(update)
	console.log(
		JSON.stringify({
			deviceId,
			objects,
		}),
	)

	await u(deviceId, objects)
}
