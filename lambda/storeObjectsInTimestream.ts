import {
	RejectedRecordsException,
	TimestreamWriteClient,
	WriteRecordsCommand,
	type _Record,
} from '@aws-sdk/client-timestream-write'
import { fromEnv } from '@bifravst/from-env'
import { requestLogger } from '@hello.nrfcloud.com/lambda-helpers/requestLogger'
import {
	isLwM2MObjectID,
	LwM2MObjectID,
} from '@hello.nrfcloud.com/proto-map/lwm2m'
import {
	instanceMeasuresToRecord,
	NoHistoryMeasuresError,
	type LwM2MShadow,
} from '@hello.nrfcloud.com/proto-map/lwm2m/aws'
import middy from '@middy/core'

const { tableInfo } = fromEnv({
	tableInfo: 'HISTORICAL_DATA_TABLE_INFO',
})(process.env)

const [DatabaseName, TableName] = tableInfo.split('|')
if (DatabaseName === undefined || TableName === undefined)
	throw new Error('Historical database is invalid')

const client = new TimestreamWriteClient({})

/**
 * Store updates to LwM2M objects in Timestream
 */
export const handler = middy<{
	deviceId: string
	reported: LwM2MShadow
}>()
	.use(requestLogger())
	.handler(async (event): Promise<void> => {
		const Records: _Record[] = []
		for (const [ObjectIDAndVersion, Instances] of Object.entries(
			event.reported,
		)) {
			const [ObjectIDString, ObjectVersion] = ObjectIDAndVersion.split(':')
			const ObjectID = parseInt(ObjectIDString ?? '0', 10)
			if (!isLwM2MObjectID(ObjectID)) continue
			// Do not store GeoLocation objects
			if (ObjectID === LwM2MObjectID.Geolocation_14201) continue
			for (const [InstanceIDString, Resources] of Object.entries(Instances)) {
				const ObjectInstanceID = parseInt(InstanceIDString ?? '0', 10)

				const maybeRecord = instanceMeasuresToRecord({
					ObjectID,
					ObjectInstanceID,
					ObjectVersion,
					Resources,
				})

				if ('error' in maybeRecord) {
					if (maybeRecord.error instanceof NoHistoryMeasuresError) {
						console.debug(`No history measures for ${ObjectID}!`)
					} else {
						console.error(maybeRecord.error)
					}
					continue
				}

				Records.push(maybeRecord.record)
			}
		}

		console.log(JSON.stringify({ Records }))

		if (Records.length === 0) {
			console.debug('No records to store')
			return
		}

		try {
			await client.send(
				new WriteRecordsCommand({
					DatabaseName,
					TableName,
					Records,
					CommonAttributes: {
						Dimensions: [
							{
								Name: 'deviceId',
								Value: event.deviceId,
							},
						],
					},
				}),
			)
		} catch (err) {
			console.debug(`Failed to persist records!`, err)
			if (err instanceof RejectedRecordsException) {
				console.debug(`Rejected records`, JSON.stringify(err.RejectedRecords))
			} else {
				console.error(err)
			}
		}
	})
