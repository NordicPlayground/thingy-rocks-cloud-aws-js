import {
	AttributeValue,
	BatchWriteItemCommand,
	DynamoDBClient,
} from '@aws-sdk/client-dynamodb'
import {
	IoTDataPlaneClient,
	UpdateThingShadowCommand,
} from '@aws-sdk/client-iot-data-plane'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { transformShadowUpdateToLwM2M } from '../lwm2m/transformShadowUpdateToLwM2M.js'
import {
	models,
	type LwM2MObjectInstance,
} from '@hello.nrfcloud.com/proto-lwm2m'
import { ulid } from 'ulid'
import { objectsToShadow } from '../lwm2m/objectsToShadow.js'

const { tableName } = fromEnv({
	tableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})
const iotData = new IoTDataPlaneClient({})
const transformUpdate = transformShadowUpdateToLwM2M(
	models['asset_tracker_v2+AWS'].transforms,
)

const persist = async (
	deviceId: string,
	objects: LwM2MObjectInstance[],
): Promise<void> => {
	await db.send(
		new BatchWriteItemCommand({
			RequestItems: {
				[tableName]: objects.map((object) => ({
					PutRequest: {
						Item: {
							id: { S: ulid() },
							deviceId: { S: deviceId },
							ObjectId: { N: object.ObjectID.toString() },
							ObjectVersion:
								object.ObjectVersion !== undefined
									? { S: object.ObjectVersion }
									: { S: '1.0' },
							Resources: {
								M: Object.entries(object.Resources).reduce(
									(map, [k, v]) => ({
										...map,
										[k]: convertValue(v),
									}),
									{},
								),
							},
							ttl: {
								N: Math.round(Date.now() / 1000 + 30 * 24 * 60 * 60).toString(),
							},
						},
					},
				})),
			},
		}),
	)
}

const convertValue = (v: string | number | boolean | Date): AttributeValue => {
	if (typeof v === 'number') return { N: v.toString() }
	if (typeof v === 'boolean') return { BOOL: v }
	if (typeof v === 'object' && v instanceof Date) return { S: v.toISOString() }
	return { S: v }
}

const updateShadow = async (
	deviceId: string,
	objects: LwM2MObjectInstance[],
): Promise<void> => {
	await iotData.send(
		new UpdateThingShadowCommand({
			thingName: deviceId,
			shadowName: 'lwm2m',
			payload: JSON.stringify({
				state: {
					reported: objectsToShadow(objects),
				},
			}),
		}),
	)
}

/**
 * Store shadow updates in asset_tracker_v2 shadow format as LwM2M objects in a named shadow.
 *
 * Also store the updates in a table for historical data.
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

	void persist(deviceId, objects)
	void updateShadow(deviceId, objects)
}
