import { type LwM2MObjectInstance } from '@hello.nrfcloud.com/proto-map/lwm2m'
import {
	fromCBOR,
	senMLtoLwM2M,
	type SenMLType,
} from '@hello.nrfcloud.com/proto-map/senml'
import cbor from 'cbor'

/**
 * Parse CBOR-encoded SenML payload from port 6667.
 * The payload is base64-encoded CBOR containing the device identity and SenML records with LwM2M objects.
 */
export const parseCborWithIdAndSenML = (
	base64Payload: string,
):
	| { deviceId: string; lwm2m: Array<LwM2MObjectInstance> }
	| { error: Error } => {
	try {
		const buffer = Buffer.from(base64Payload, 'base64')
		const decoded = cbor.decodeAllSync(buffer)
		console.log(decoded)
		// CBOR decoded result is an array of arrays, we need to flatten it
		const [deviceId, cborRecords] = decoded[0] as [
			string,
			Array<Record<number, unknown>>,
		]
		const senML = fromCBOR(cborRecords) as SenMLType
		const maybeLwM2M = senMLtoLwM2M(senML)
		if ('error' in maybeLwM2M) {
			return { error: maybeLwM2M.error }
		}
		return { deviceId, lwm2m: maybeLwM2M.lwm2m }
	} catch (error) {
		return { error: error instanceof Error ? error : new Error(String(error)) }
	}
}
