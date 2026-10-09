import type { LwM2MObjectInstance } from '@hello.nrfcloud.com/proto-map/lwm2m'
import { Type, type Static } from '@sinclair/typebox'
import { validateWithTypeBox } from '../lambda/validateWithTypeBox.ts'
import { parseCborWithIdAndSenML } from '../lwm2m/parseCborWithIdAndSenML.ts'
import { parse as parseCsv } from '../ntn-udp-payload/parse.ts'

/**
 * The JSON serialised `Data` field of a Myriota message
 *
 * @see https://support.myriota.com/hc/en-us/articles/6482340814351-HTTP
 */
export const MyriotaData = Type.Object({
	Packets: Type.Array(
		Type.Object({
			Timestamp: Type.Integer({
				description: 'Unix Epoch time (ms) at which the packet was captured',
			}),
			TerminalId: Type.String({ minLength: 1 }),
			Value: Type.String({ description: 'Hex encoded payload' }),
		}),
	),
})

export type MyriotaPacket = Static<typeof MyriotaData>['Packets'][number]

const validate = validateWithTypeBox(MyriotaData)

export const parseMyriotaData = (
	data: string,
): { packets: Array<MyriotaPacket> } | { error: Error } => {
	let maybeData: unknown
	try {
		maybeData = JSON.parse(data)
	} catch (error) {
		return { error: error as Error }
	}
	const maybeValid = validate(maybeData)
	if ('errors' in maybeValid)
		return {
			error: new Error(`Invalid data: ${JSON.stringify(maybeValid.errors)}`),
		}
	return { packets: maybeValid.value.Packets }
}

/**
 * The packet value uses the same encodings as the UDP ingest (port 6667):
 *
 * - the legacy comma separated text format, see ntn-udp-payload/parse.ts
 * - CBOR containing a device identity and SenML records with LwM2M objects.
 *
 * The device identity in the payload is not used, devices are identified by their Myriota TerminalId instead.
 */
export const parseMyriotaPacketValue = (
	value: string,
	now = new Date(),
): { lwm2m: Array<LwM2MObjectInstance> } | { error: Error } => {
	if (!/^([0-9a-f]{2})+$/i.test(value))
		return { error: new Error(`Value is not hex encoded: ${value}`) }
	const buffer = Buffer.from(value, 'hex')

	const csv = parseCsv(buffer.toString('utf-8'), now)
	if (csv !== null) return { lwm2m: csv }

	const res = parseCborWithIdAndSenML(buffer.toString('base64'))
	if ('error' in res) return res
	return { lwm2m: res.lwm2m }
}
