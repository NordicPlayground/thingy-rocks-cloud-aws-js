import type { DescribeThingCommand, IoTClient } from '@aws-sdk/client-iot'
import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import { thingExists } from './thingExists.ts'

void describe('thingExists', () => {
	void it('should check if thing exists in Iot Core', async () => {
		const icSend = mock.fn(async () =>
			Promise.resolve({
				$metadata: {
					httpStatusCode: 200,
					requestId: '',
					extendedRequestId: undefined,
					cfId: undefined,
					attempts: 1,
					totalRetryDelay: 0,
				},
				attributes: { name: 'myDevice123' },
				defaultClientId: '',
				thingArn: '',
				thingId: '',
				thingName: '',
				thingTypeName: '',
				version: 3,
			}),
		)
		const iotClient: IoTClient = { send: icSend } as unknown as IoTClient
		const result = await thingExists(iotClient, 'myDevice123')
		assert.equal(result, true)
		assert.equal(icSend.mock.calls.length, 1)

		const firstCall = icSend.mock.calls[0]
		const cmd = Array.isArray(firstCall)
			? firstCall[0]
			: (firstCall as any).arguments?.[0]
		assert.ok(cmd !== undefined, 'no command recorded in mock calls')
		assert.equal(cmd.input?.thingName, 'myDevice123')
		assert.equal(cmd.constructor?.name, 'DescribeThingCommand')
	})
	void it('should handle non-existing thing in Iot Core', async () => {
		const icSend = mock.fn(async () => {
			const error = new Error('Resource not found')
			error.name = 'ResourceNotFoundException'
			throw error
		})
		const iotClient: IoTClient = { send: icSend } as unknown as IoTClient
		const result = await thingExists(iotClient, 'mySecondDevice123')

		assert.equal(result, false)
		assert.equal(icSend.mock.calls.length, 1)

		const firstCall = icSend.mock.calls[0]
		const cmd = (
			Array.isArray(firstCall)
				? firstCall[0]
				: (firstCall as any).arguments?.[0]
		) as DescribeThingCommand | undefined

		assert.ok(cmd !== undefined, 'no command recorded in mock calls')
		assert.equal(cmd.input.thingName, 'mySecondDevice123')
		assert.equal(cmd.constructor.name, 'DescribeThingCommand')
	})
})
