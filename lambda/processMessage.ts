import type { LwM2MObjectInstance } from '@hello.nrfcloud.com/proto-map/lwm2m'
import { shadowToObjects } from '@hello.nrfcloud.com/proto-map/lwm2m/aws'
import { locationDataFromCOAPToLwm2m } from '../nordicNRPlus/locationDataFromCOAPToLwm2m.ts'
import { parseCBORLocationData } from '../nordicNRPlus/parseCbor.ts'
import type { inputSchemaLwm2mMessage } from './webhookHandler.ts'

type messageType = (typeof inputSchemaLwm2mMessage.messages)[0]

export const processLWM2MShadow = (
	message: messageType,
): LwM2MObjectInstance[] | undefined => {
	const lwm2m = message.current?.state?.reported?.lwm2m
	if (lwm2m !== undefined && Object.keys(lwm2m).length > 0) {
		return shadowToObjects(lwm2m)
	}
	return undefined
}

export const processCoAPMessage = (
	message: messageType,
): LwM2MObjectInstance[] | undefined => {
	if (
		message.message.response?.body !== undefined &&
		message.coapRequestUrl === 'FETCH /loc/ground-fix'
	) {
		const base64 = message.message.response.body
		const parsed = parseCBORLocationData(base64)
		const ts = Date.parse(message.receivedAt ?? '') || Date.now()
		return locationDataFromCOAPToLwm2m(parsed, ts)
	}
	return undefined
}

const handlers = [processLWM2MShadow, processCoAPMessage]

export const processMessage = (
	message: messageType,
): LwM2MObjectInstance[] | undefined => {
	const chain = handlers
	return chain.reduce(
		(result, handler) => {
			if (result) {
				return result
			} else {
				return handler(message)
			}
		},
		undefined as LwM2MObjectInstance[] | undefined,
	)
}
