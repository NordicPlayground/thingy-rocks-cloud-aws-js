import type { LwM2MObjectInstance } from '@hello.nrfcloud.com/proto-map/lwm2m'
import type { LocationData } from './parseCbor.ts'

export const locationDataFromCOAPToLwm2m = (
	location: LocationData,
	ts: number,
): LwM2MObjectInstance[] => [
	{
		ObjectID: 14201,
		ObjectVersion: '1.0',
		ObjectInstanceID: location.src === 'WIFI' ? 1 : 0,
		Resources: {
			'0': location.lat,
			'1': location.lon,
			'3': location.uncertainty,
			'6': location.src,
			'99': ts / 1000,
		},
	},
]
