import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { fromEnv } from '@bifravst/from-env'
import { aResponse } from '@hello.nrfcloud.com/lambda-helpers/aResponse'
import { addVersionHeader } from '@hello.nrfcloud.com/lambda-helpers/addVersionHeader'
import { corsOPTIONS } from '@hello.nrfcloud.com/lambda-helpers/corsOPTIONS'
import { requestLogger } from '@hello.nrfcloud.com/lambda-helpers/requestLogger'
import {
	validateInput,
	type ValidInput,
} from '@hello.nrfcloud.com/lambda-helpers/validateInput'
import { HttpStatusCode, deviceId } from '@hello.nrfcloud.com/proto/hello'
import middy from '@middy/core'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { decodeTime } from 'ulidx'

const { udpDatagramsTableName, version } = fromEnv({
	udpDatagramsTableName: 'UDP_DATAGRAMS_TABLE_NAME',
	version: 'VERSION',
})(process.env)

const db = new DynamoDBClient({})

const InputSchema = Type.Object({
	deviceId,
})

const logDb = {
	findLogs: async (device: { id: string }) => {
		const { Items } = await db.send(
			new QueryCommand({
				TableName: udpDatagramsTableName,
				KeyConditionExpression: 'deviceId = :deviceId',
				ExpressionAttributeValues: {
					':deviceId': { S: device.id },
				},
				Limit: 100,
				ScanIndexForward: false,
			}),
		)
		return (
			Items?.map((i) => {
				const data = unmarshall(i)

				delete data.ttl
				delete data.deviceId

				return {
					...data,
					ts: new Date(decodeTime(data.messageId)).toISOString(),
				}
			}) ?? []
		)
	},
}

const h = async (
	event: APIGatewayProxyEventV2,
	context: ValidInput<typeof InputSchema>,
): Promise<APIGatewayProxyResultV2> =>
	aResponse(
		HttpStatusCode.OK,
		{
			'@context': new URL('https://thingy.rocks/lwm2m-udp-import'),
			id: context.validInput.deviceId,
			imports: await logDb.findLogs({ id: context.validInput.deviceId }),
		},
		60,
	)

export const handler = middy()
	.use(corsOPTIONS('GET'))
	.use(addVersionHeader(version))
	.use(requestLogger())
	.use(validateInput(InputSchema))
	.handler(h)
