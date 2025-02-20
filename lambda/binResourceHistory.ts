import {
	QueryCommand,
	type TimestreamQueryClient,
} from '@aws-sdk/client-timestream-query'
import { getAvailableColumns, parseResult } from '@bifravst/timestream-helpers'
import {
	type LWM2MObjectInfo,
	isNumeric,
	timestampResources,
} from '@hello.nrfcloud.com/proto-map/lwm2m'

export const binResourceHistory = ({
	DatabaseName,
	TableName,
	ts,
	devices,
}: {
	DatabaseName: string
	TableName: string
	ts: TimestreamQueryClient
	devices: Array<string>
}) => {
	const availableColumnsCache = getAvailableColumns(
		ts,
		DatabaseName,
		TableName,
	)()
	return async ({
		def,
		instance,
		aggregateFn,
		hours,
	}: {
		def: LWM2MObjectInfo
		instance?: number
		aggregateFn: string
		hours: number
	}): Promise<
		Array<Record<number, string | number | boolean> & { deviceId: string }>
	> => {
		const availableColumns = await availableColumnsCache
		const resourceNames = Object.values(def.Resources)
			.filter(isNumeric)
			.map<[string, number]>(({ ResourceID }) => [
				`${def.ObjectID}/${def.ObjectVersion}/${ResourceID}`,
				ResourceID,
			])
			// Only select the columns that exist
			.filter(([name]) => {
				const available = availableColumns.includes(name)
				if (!available) console.warn(`Column not found: ${name}!`)
				return available
			})
		const tsResource = timestampResources.get(def.ObjectID)
		if (tsResource === undefined) {
			console.error(
				`No timestamp resource defined for found for ${def.ObjectID}!`,
			)
			return []
		}
		const columns = [
			'deviceId',
			...resourceNames.map(
				([alias, ResourceID]) =>
					`${aggregateFn}("${alias}") AS "${ResourceID}"`,
			),
			`cast(floor(to_unixtime(bin(time, 1minute))) AS int) AS "${tsResource}"`,
		]

		if (columns.length === 0) {
			console.error(`No columns found for ${def.ObjectID}/${instance ?? 0}!`)
			console.error(`Available columns: ${availableColumns.join(', ')}`)
			return []
		}

		const QueryString = [
			`SELECT `,
			columns.join(','),
			`FROM "${DatabaseName}"."${TableName}"`,
			`WHERE measure_name = '${def.ObjectID}/${instance ?? 0}'`,
			`AND time > date_add('hour', -${hours}, now())`,
			`AND ObjectID = '${def.ObjectID}'`,
			`AND ObjectInstanceID = '${instance ?? 0}'`,
			`AND ObjectVersion = '${def.ObjectVersion}'`,
			`AND deviceId IN (${devices.map((d) => `'${d}'`).join(',')})`,
			`GROUP BY deviceId, bin(time, 1minute)`,
			`ORDER BY bin(time, 1minute) DESC`,
		].join(' ')

		console.log({ QueryString })
		const result = await ts.send(
			new QueryCommand({
				QueryString,
			}),
		)
		console.debug(JSON.stringify({ result }))
		return parseResult(result)
	}
}
