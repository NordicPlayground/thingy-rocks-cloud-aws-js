import type { TimestreamQueryClient } from '@aws-sdk/client-timestream-query'
import {
	QueryCommand,
	type QueryResponse,
} from '@aws-sdk/client-timestream-query'
import { parseResult } from '@bifravst/timestream-helpers'
import {
	definitions,
	LwM2MObjectID,
	type BatteryAndPower_14202,
	type ConnectionQuality_14501,
	type Environment_14205,
} from '@hello.nrfcloud.com/proto-map/lwm2m'
import { binResourceHistory } from './binResourceHistory.ts'

const summaryQuery = ({
	db,
	table,
	measureName,
	hours,
}: {
	db: string
	table: string
	measureName: string
	hours: number
}) =>
	[
		`SELECT deviceId,`,
		`MIN(measure_value::double) AS v,`,
		`bin(time, 1minute) as ts`,
		`FROM "${db}"."${table}"`,
		`WHERE measure_name='${measureName}'`,
		`AND time > date_add('hour', -${hours}, now())`,
		`GROUP BY deviceId, bin(time, 1minute)`,
		`ORDER BY bin(time, 1minute) DESC`,
	].join(' ')

type QueryResult = {
	deviceId: string //'352656100834590',
	v: number //4.421,
	ts: Date //2022-12-07T08:07:00.000Z
}

type Reading = [
	v: number,
	// Delta to the base date in seconds
	d: number,
]
type Readings = Reading[]

export type Summary = {
	bat?: Readings
	temp?: Readings
	hPa?: Readings
	// Fuel gauge readings, see https://github.com/NordicSemiconductor/asset-tracker-cloud-docs/blob/4713549af719a7e119324853aa117d752ac856e3/docs/cloud-protocol/Reported.ts#L111
	fgSoC?: Readings
	fgI?: Readings
	// Connection Quality: Latency
	cqLatency?: Readings
	base: Date
}

type Summaries = Record<string, Summary>

const groupResult = (
	summaries: Summaries,
	key: keyof Summary,
	result: QueryResponse,
	base: Date,
	transform: (v: number) => number = (v) => v,
) => {
	for (const { deviceId, v, ts } of parseResult<QueryResult>(result)) {
		const reading: Reading = [
			parseFloat(transform(v).toFixed(3)),
			Math.max(0, Math.floor((base.getTime() - ts.getTime()) / 1000)),
		]
		if (summaries[deviceId] === undefined)
			summaries[deviceId] = {
				base,
			} as Summary
		if (summaries[deviceId][key] === undefined) {
			;(summaries[deviceId][key] as unknown as Readings) = [reading]
		} else {
			;(summaries[deviceId][key] as Readings).push(reading)
		}
	}
}

export const createChartSummary = async ({
	timestream,
	historicaldataDatabaseName,
	historicaldataTableName,
	lwm2mObjectHistoryDbName,
	lwm2mObjectHistoryTableName,
	lwm2mHistoryDevices,
}: {
	timestream: TimestreamQueryClient
	historicaldataDatabaseName: string
	historicaldataTableName: string
	lwm2mObjectHistoryDbName: string
	lwm2mObjectHistoryTableName: string
	lwm2mHistoryDevices: Array<string>
}): Promise<Summaries> => {
	const binnedLwM2MObjectHistory = binResourceHistory({
		DatabaseName: lwm2mObjectHistoryDbName,
		TableName: lwm2mObjectHistoryTableName,
		ts: timestream,
		devices: lwm2mHistoryDevices,
	})

	const [bat, temp, fgSoC, fgI] = await Promise.all([
		timestream.send(
			new QueryCommand({
				QueryString: summaryQuery({
					db: historicaldataDatabaseName,
					table: historicaldataTableName,
					measureName: 'bat',
					hours: 1,
				}),
			}),
		),
		timestream.send(
			new QueryCommand({
				QueryString: summaryQuery({
					db: historicaldataDatabaseName,
					table: historicaldataTableName,
					measureName: 'env.temp',
					hours: 1,
				}),
			}),
		),
		timestream.send(
			new QueryCommand({
				QueryString: summaryQuery({
					db: historicaldataDatabaseName,
					table: historicaldataTableName,
					measureName: 'fg.SoC',
					hours: 1,
				}),
			}),
		),
		timestream.send(
			new QueryCommand({
				QueryString: summaryQuery({
					db: historicaldataDatabaseName,
					table: historicaldataTableName,
					measureName: 'fg.I',
					hours: 1,
				}),
			}),
		),
	])
	const now = new Date()
	const summaries: Summaries = {}
	groupResult(summaries, 'bat', bat, now, (v) => v / 1000)
	groupResult(summaries, 'temp', temp, now)
	groupResult(summaries, 'fgSoC', fgSoC, now)
	groupResult(summaries, 'fgI', fgI, now)

	// Get the temperature readings from the last hour

	const lwm2mTemps = (await binnedLwM2MObjectHistory({
		def: definitions[LwM2MObjectID.Environment_14205],
		aggregateFn: 'avg',
		hours: 1,
	})) as Array<
		{ [99]: number; deviceId: string } & Environment_14205['Resources']
	>

	groupLwM2MResult(
		summaries,
		'temp',
		lwm2mTemps as Array<LwM2MResult>,
		now,
		(r) => r[0],
	)

	const lwm2mTempsInstance1 = (await binnedLwM2MObjectHistory({
		def: definitions[LwM2MObjectID.Environment_14205],
		instance: 1,
		aggregateFn: 'avg',
		hours: 1,
	})) as Array<
		{ [99]: number; deviceId: string } & Environment_14205['Resources']
	>

	groupLwM2MResult(
		summaries,
		'temp',
		lwm2mTempsInstance1 as Array<LwM2MResult>,
		now,
		(r) => r[0],
	)

	// Atmospheric pressure

	const lwm2mPressure = (await binnedLwM2MObjectHistory({
		def: definitions[LwM2MObjectID.Environment_14205],
		aggregateFn: 'avg',
		hours: 1,
	})) as Array<
		{ [99]: number; deviceId: string } & Environment_14205['Resources']
	>

	groupLwM2MResult(
		summaries,
		'hPa',
		lwm2mPressure as Array<LwM2MResult>,
		now,
		(r) => r[2],
	)

	// Voltage

	const lwm2mVoltage = (await binnedLwM2MObjectHistory({
		def: definitions[LwM2MObjectID.BatteryAndPower_14202],
		instance: 1,
		aggregateFn: 'avg',
		hours: 1,
	})) as Array<
		{ [99]: number; deviceId: string } & BatteryAndPower_14202['Resources']
	>

	groupLwM2MResult(
		summaries,
		'bat',
		lwm2mVoltage as Array<LwM2MResult>,
		now,
		(r) => r[1],
	)

	// State of charge

	const lwm2mSoC = (await binnedLwM2MObjectHistory({
		def: definitions[LwM2MObjectID.BatteryAndPower_14202],
		aggregateFn: 'avg',
		hours: 1,
	})) as Array<
		{ [99]: number; deviceId: string } & BatteryAndPower_14202['Resources']
	>

	groupLwM2MResult(
		summaries,
		'fgSoC',
		lwm2mSoC as Array<LwM2MResult>,
		now,
		(r) => r[0],
	)

	// Latency

	const lwm2mLatency = (await binnedLwM2MObjectHistory({
		def: definitions[LwM2MObjectID.ConnectionQuality_14501],
		aggregateFn: 'avg',
		hours: 1,
	})) as Array<
		{ [99]: number; deviceId: string } & ConnectionQuality_14501['Resources']
	>

	groupLwM2MResult(
		summaries,
		'cqLatency',
		lwm2mLatency as Array<LwM2MResult>,
		now,
		(r) => r[0],
	)

	return summaries
}

type LwM2MResult = Record<string, number> & {
	[99]: number
	deviceId: string
}

const groupLwM2MResult = <PartialInstance extends LwM2MResult>(
	summaries: Summaries,
	key: keyof Summary,
	results: Array<PartialInstance>,
	now: Date,
	getValue: (r: PartialInstance) => number | undefined,
) => {
	for (const result of results) {
		const { deviceId, ...resources } = result
		if (summaries[deviceId] === undefined) {
			summaries[deviceId] = {
				base: now,
			}
		}
		const v = getValue(result)
		if (v === undefined) continue
		const d = Math.max(
			0,
			Math.floor((now.getTime() - resources[99] * 1000) / 1000),
		)
		if (summaries[deviceId][key] === undefined) {
			;(summaries[deviceId][key] as unknown as Readings) = [[v, d]]
		} else {
			;(summaries[deviceId][key] as Readings).push([v, d])
		}
	}
}
