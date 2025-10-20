import { IoTClient } from '@aws-sdk/client-iot'
import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane'
import { validateInput } from '@hello.nrfcloud.com/lambda-helpers/validateInput'
import middy from '@middy/core'
import inputOutputLogger from '@middy/input-output-logger'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { ensureThingExists } from '../nordicNRPlus/ensureThingExists.ts'
import {
	inputSchemaLwm2mMessage,
	processNrplusMessagesAndUpdateThingShadow,
} from '../nordicNRPlus/processNrplusMessagesAndUpdateThingShadow.ts'
import { thingExists } from '../nordicNRPlus/thingExists.ts'
import { updateShadow } from './updateShadow.ts'

export const iotData = new IoTDataPlaneClient({})
const iotClient = new IoTClient({})

const u = updateShadow(iotData)
const ensureThing = ensureThingExists(iotClient, thingExists)

const handle = processNrplusMessagesAndUpdateThingShadow({
	ensureThing,
	updateShadow: u,
	log: (...args) => console.log('[nordicNRPlusHandler]', ...args),
})

export const handler = middy<APIGatewayProxyEventV2, APIGatewayProxyResultV2>()
	.use(inputOutputLogger())
	.use(validateInput(inputSchemaLwm2mMessage))
	.handler(async (event, context) => {
		if (event.requestContext.http.method !== 'POST') {
			return {
				statusCode: 405,
				body: 'Method Not Allowed',
			}
		}
		await handle(context.decodedInput)
		return {
			statusCode: 200,
		}
	})
