import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { updatesToShadow } from './objectsToShadow.js'

void describe('updatesToShadow()', () => {
	void it('should convert a list update LwM2M objects to a shadow document', () =>
		assert.deepEqual(
			updatesToShadow([
				{
					ObjectID: 14205,
					Resources: {
						'0': 27.69,
						'1': 18.9,
						'2': 97.271,
						'99': new Date('2023-11-05T15:13:28.705Z'),
					},
				},
				{
					ObjectID: 14202,
					Resources: {
						'0': 99,
						'1': 4.174,
						'2': 0,
						'3': 25.9,
						'99': new Date('2023-11-05T15:13:49.276Z'),
					},
				},
				{
					ObjectID: 14203,
					Resources: {
						'0': 'LTE-M',
						'1': 20,
						'2': -93,
						'3': 2305,
						'4': 34237196,
						'5': 24202,
						'6': '100.81.95.75',
						'11': 7,
						'99': new Date('2023-11-05T15:13:28.795Z'),
					},
				},
			]),
			{
				'14205:1.0': {
					'0': { v: 27.69, ts: 1699197208705 },
					'1': { v: 18.9, ts: 1699197208705 },
					'2': { v: 97.271, ts: 1699197208705 },
				},
				'14203:1.0': {
					'0': { v: 'LTE-M', ts: 1699197208795 },
					'1': { v: 20, ts: 1699197208795 },
					'2': { v: -93, ts: 1699197208795 },
					'3': { v: 2305, ts: 1699197208795 },
					'4': { v: 34237196, ts: 1699197208795 },
					'5': { v: 24202, ts: 1699197208795 },
					'6': { v: '100.81.95.75', ts: 1699197208795 },
					'11': { v: 7, ts: 1699197208795 },
				},
				'14202:1.0': {
					'0': { v: 99, ts: 1699197229276 },
					'1': { v: 4.174, ts: 1699197229276 },
					'2': { v: 0, ts: 1699197229276 },
					'3': { v: 25.9, ts: 1699197229276 },
				},
			},
		))
})
