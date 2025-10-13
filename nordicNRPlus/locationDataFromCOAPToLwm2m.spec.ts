import assert from 'node:assert/strict'
import { describe } from 'node:test'
import { locationDataFromCOAPToLwm2m } from './locationDataFromCOAPToLwm2m.ts'

void describe('locationToLwm2m', () => {
	const locationObject = {
		lat: 63.431703,
		lon: 10.396597,
		uncertainty: 20,
		src: 'WIFI',
	}
	const expectedResult = [
		{
			ObjectID: 14201,
			ObjectVersion: '1.0',
			ObjectInstanceID: 1,
			Resources: {
				'0': 63.431703,
				'1': 10.396597,
				'3': 20,
				'6': 'WIFI',
				'99': 1699217657,
			},
		},
	]
	assert.deepEqual(
		locationDataFromCOAPToLwm2m(locationObject, 1699217657000),
		expectedResult,
	)
})
