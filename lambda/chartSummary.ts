import {
	QueryCommand,
	TimestreamQueryClient,
	type QueryResponse,
} from '@aws-sdk/client-timestream-query'
import { parseResult } from '@nordicsemiconductor/timestream-helpers'

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
	// Fuel gauge readings, see https://github.com/NordicSemiconductor/asset-tracker-cloud-docs/blob/4713549af719a7e119324853aa117d752ac856e3/docs/cloud-protocol/Reported.ts#L111
	fgSoC?: Readings
	fgI?: Readings
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
		if ((summaries[deviceId] as Summary)[key] === undefined) {
			;((summaries[deviceId] as Summary)[key] as Readings) = [reading]
		} else {
			;((summaries[deviceId] as Summary)[key] as Readings).push(reading)
		}
	}
}

export const createChartSummary = async ({
	timestream,
	historicaldataDatabaseName,
	historicaldataTableName,
}: {
	timestream: TimestreamQueryClient
	historicaldataDatabaseName: string
	historicaldataTableName: string
}): Promise<Summaries> => {
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

	return summaries
}
