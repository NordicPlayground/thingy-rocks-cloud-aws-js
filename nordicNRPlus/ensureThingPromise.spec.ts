import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import { ensureThingPromise } from './ensureThingPromise.ts'

void describe('ensureThingPromise', async () => {
	void it('should ensure thing promise works correctly', async () => {
		const ensuredThings = new Map<string, Promise<void>>()
		const ensureThing = mock.fn(async () => {})

		await ensureThingPromise(ensuredThings, ensureThing, 'testThing1')
		await ensureThingPromise(ensuredThings, ensureThing, 'testThing1')
		await ensureThingPromise(ensuredThings, ensureThing, 'testThing2')
		assert.equal(ensureThing.mock.calls.length, 2, 'ensureThing called twice')
		assert.equal(ensuredThings.size, 2, 'ensuredThings has two entries')
	})
})
