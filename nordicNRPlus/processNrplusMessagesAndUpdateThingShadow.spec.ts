import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, it, mock } from 'node:test'
import { processNrplusMessagesAndUpdateThingShadow } from './processNrplusMessagesAndUpdateThingShadow.ts'

const __dirname = new URL('./exampleMessages', import.meta.url).pathname

void describe('processNrplusMessagesAndUpdateThingShadow', () => {
	void it('should throw error if ensureThing fails', async () => {
		const thingName = 'team1-device1'
		const ensureThing = mock.fn(async () => {
			throw new Error('Failed to ensure thing')
		})
		const updateShadow = mock.fn(async () => {})
		const process = processNrplusMessagesAndUpdateThingShadow({
			ensureThing,
			updateShadow,
		})
		await assert.rejects(async () => {
			await process({
				messages: [
					{
						teamId: thingName,
						deviceId: '',
						messageId: '',
						message: undefined,
					},
				],
				type: 'device.messages',
				timestamp: '',
			})
		}, /Failed to ensure thing exists/)
	})
	void it('should process the message when thing exists', async () => {
		const ensureThing = mock.fn(async () => {})
		const updateShadow = mock.fn(async () => {})
		const process = processNrplusMessagesAndUpdateThingShadow({
			ensureThing,
			updateShadow,
		})
		await process({
			messages: [
				{
					teamId: 'thingName',
					deviceId: '',
					messageId: '',
					message: { test: 'message' },
				},
			],
			type: 'device.messages',
			timestamp: '',
		})
		assert.equal(ensureThing.mock.calls.length, 1, 'ensureThing is called')
		assert.equal(
			updateShadow.mock.calls.length,
			0,
			'updateShadow is not called because message is undefined',
		)
	})
	void it('should process a location message and update shadow when thing exists and format is correct', async () => {
		const thingName = 'team1'
		const deviceName = 'device1'
		const ensureThing = mock.fn(async () => {})
		const updateShadow = mock.fn(async () => {})
		const receivedAt = new Date('2024-09-13T12:31:22.000Z').toISOString()
		const process = processNrplusMessagesAndUpdateThingShadow({
			ensureThing,
			updateShadow,
		})
		await process({
			messages: [
				{
					teamId: thingName,
					deviceId: deviceName,
					messageId: '',
					message: JSON.parse(
						await readFile(
							path.join(__dirname, './exampleLocationCoAPMessage.json'),
							'utf-8',
						),
					),
					receivedAt,
					coapRequestUrl: 'FETCH /loc/ground-fix',
				},
			],
			type: 'device.messages',
			timestamp: '',
		})
		assert.equal(ensureThing.mock.calls.length, 1, 'ensureThing is called')
		assert.equal(updateShadow.mock.calls.length, 1, 'updateShadow is called')

		const firstCallUpdate = updateShadow.mock.calls[0]
		const secondArgumentUpdate = Array.isArray(firstCallUpdate)
			? firstCallUpdate[1]
			: (firstCallUpdate as any).arguments?.[1]
		assert.deepEqual(
			secondArgumentUpdate,
			[
				{
					ObjectID: 14201,
					ObjectVersion: '1.0',
					ObjectInstanceID: 1,
					Resources: {
						'0': 63.4317043,
						'1': 10.4711207,
						'3': 17.245,
						'6': 'WIFI',
						'99': Date.parse(receivedAt) / 1000,
					},
				},
			],
			'updateShadow is called with correct message',
		)
	})
	void it('should not update shadow if message is unhandled', async () => {
		const thingName = 'team1'
		const deviceId = 'device1'
		const ensureThing = mock.fn(async () => {})
		const updateShadow = mock.fn(async () => {})
		const process = processNrplusMessagesAndUpdateThingShadow({
			ensureThing,
			updateShadow,
		})
		await process({
			messages: [
				{
					teamId: thingName,
					deviceId,
					messageId: '',
					message: JSON.parse(
						await readFile(
							path.join(__dirname, './exampleShadow.json'),
							'utf-8',
						),
					),
				},
			],
			type: 'device.messages',
			timestamp: '',
		})
		assert.equal(ensureThing.mock.calls.length, 1, 'ensureThing is called')
		assert.equal(updateShadow.mock.calls.length, 1, 'updateShadow is called')

		const firstCall = ensureThing.mock.calls[0]
		const firstArgument = Array.isArray(firstCall)
			? firstCall[0]
			: (firstCall as any).arguments?.[0]
		assert.equal(
			firstArgument,
			thingName + '-' + deviceId,
			'ensureThing is called with correct thingName',
		)

		const firstCallUpdate = updateShadow.mock.calls[0]
		const firstArgumentUpdate = Array.isArray(firstCallUpdate)
			? firstCallUpdate[0]
			: (firstCallUpdate as any).arguments?.[0]
		assert.equal(
			firstArgumentUpdate,
			thingName + '-' + deviceId,
			'updateShadow is called with correct thingName',
		)

		const secondArgumentUpdate = Array.isArray(firstCallUpdate)
			? firstCallUpdate[1]
			: (firstCallUpdate as any).arguments?.[1]
		assert.deepEqual(
			secondArgumentUpdate,
			[
				{
					ObjectID: 14503,
					ObjectVersion: '1.0',
					Resources: {
						'0': 1592461780,
						'1': 703710,
						'2': 'FT',
						'99': 1760514064,
					},
				},
				{
					ObjectID: 14502,
					ObjectVersion: '1.0',
					Resources: { '0': 696113427, '1': 0, '99': 1760524760 },
				},
			],
			'updateShadow is called with correct message',
		)
	})
	void it('should not update shadow if message is unhandled', async () => {
		const thingName = 'team1'
		const deviceId = 'device1'
		const ensureThing = mock.fn(async () => {})
		const updateShadow = mock.fn(async () => {})
		const process = processNrplusMessagesAndUpdateThingShadow({
			ensureThing,
			updateShadow,
		})
		await process({
			messages: [
				{
					teamId: thingName,
					deviceId,
					messageId: '',
					message: { test: 'message' },
				},
			],
			type: 'device.messages',
			timestamp: '',
		})
		assert.equal(ensureThing.mock.calls.length, 1, 'ensureThing is called')
		assert.equal(
			updateShadow.mock.calls.length,
			0,
			'updateShadow is not called',
		)
	})
})
