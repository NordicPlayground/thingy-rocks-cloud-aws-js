import type { LwM2MObjectInstance } from '@hello.nrfcloud.com/proto-map/lwm2m'
import { shadowToObjects } from '@hello.nrfcloud.com/proto-map/lwm2m/aws'
import { locationDataFromCOAPToLwm2m } from './locationDataFromCOAPToLwm2m.ts'
import { parseCBORLocationData } from './parseCbor.ts'
import type { inputSchemaLwm2mMessage } from './processNrplusMessagesAndUpdateThingShadow.ts'

type messageType = (typeof inputSchemaLwm2mMessage.messages)[0]

export const processLWM2MShadow = (
	message: messageType,
): LwM2MObjectInstance[] | undefined => {
	if (!isLwM2MShadow(message)) return undefined
	const lwm2m = message.message.current?.state?.reported?.lwm2m
	return shadowToObjects(lwm2m)
}

export const processCoAPMessage = (
	message: messageType,
): LwM2MObjectInstance[] | undefined => {
	if (!isGroundFixRequest(message)) return undefined
	const base64 = message.message.response.body
	const parsed = parseCBORLocationData(base64)
	const ts = Date.parse(message.receivedAt ?? '') || Date.now()
	return locationDataFromCOAPToLwm2m(parsed, ts)
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

export const isGroundFixRequest = (message: messageType): boolean => {
	if (message.message.response?.body === undefined) return false
	if (message.coapRequestUrl !== 'FETCH /loc/ground-fix') return false
	return true
}

const isLwM2MShadow = (message: messageType): boolean => {
	const lwm2m = message.message.current?.state?.reported?.lwm2m
	if (lwm2m === undefined) return false
	if (Object.keys(lwm2m).length === 0) return false
	return true
}
