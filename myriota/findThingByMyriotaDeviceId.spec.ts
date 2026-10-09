import type { ListThingsCommand } from '@aws-sdk/client-iot'
import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import { findThingByMyriotaDeviceId } from './findThingByMyriotaDeviceId.ts'

void describe('findThingByMyriotaDeviceId()', () => {
	void it('should look up the thing by attribute and remember the result', async () => {
		const send = mock.fn(async (cmd: ListThingsCommand) => {
			assert.equal(cmd.input.attributeName, 'myriotaDeviceId')
			return {
				things:
					cmd.input.attributeValue === '89883380001010376490'
						? [{ thingName: 'my-thing' }]
						: [],
			}
		})
		const find = findThingByMyriotaDeviceId({ send })

		assert.equal(await find('89883380001010376490'), 'my-thing')
		assert.equal(await find('89883380001010376490'), 'my-thing')
		assert.equal(await find('unknown'), null)
		assert.equal(await find('unknown'), null)
		assert.equal(send.mock.callCount(), 2)
	})

	void it('should not remember failed lookups', async () => {
		let fail = true
		const send = mock.fn(async () => {
			if (fail) throw new Error('Throttled')
			return { things: [{ thingName: 'my-thing' }] }
		})
		const find = findThingByMyriotaDeviceId({ send })

		await assert.rejects(find('89883380001010376490'))
		fail = false
		assert.equal(await find('89883380001010376490'), 'my-thing')
		assert.equal(send.mock.callCount(), 2)
	})
})
