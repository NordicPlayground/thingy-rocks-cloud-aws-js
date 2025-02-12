import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane'
import { requestLogger } from '@hello.nrfcloud.com/lambda-helpers/requestLogger'
import {
	senMLtoLwM2M,
	type SenMLType,
} from '@hello.nrfcloud.com/proto-map/senml'
import middy from '@middy/core'
import { updateShadow } from './updateShadow.ts'

const u = updateShadow(new IoTDataPlaneClient())

export const handler = middy()
	.use(requestLogger())
	.handler(
		async (event: {
			gatewayId: string
			deviceId: string
			timestamp: number
			senML: SenMLType
		}) => {
			const { deviceId, senML, gatewayId } = event

			const maybeObjects = senMLtoLwM2M(senML as any)

			const iotThingName = `${gatewayId}-${deviceId}`

			if ('error' in maybeObjects) {
				console.error(
					`[${iotThingName}]`,
					JSON.stringify(maybeObjects.error.message),
				)
				return
			}

			const objects = maybeObjects.lwm2m
			console.debug(`[${iotThingName}]`, JSON.stringify(maybeObjects))

			if (objects.length === 0) {
				console.debug(`No LwM2M objects found.`)
				return
			}

			await u(iotThingName, objects)
		},
	)
