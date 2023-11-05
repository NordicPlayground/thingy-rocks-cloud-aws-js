import {
	timestampResources,
	type LwM2MObject,
} from '@hello.nrfcloud.com/proto-lwm2m'
import type { LwM2MShadow } from './objectsToShadow'

export const shadowToObjects = (shadow: LwM2MShadow): LwM2MObject[] =>
	Object.entries(shadow)
		.map(([ObjectIdAndVersion, Resources]) => {
			const [ObjectIDString, ObjectVersion] = ObjectIdAndVersion.split(':') as [
				string,
				string,
			]
			const ObjectID = parseInt(ObjectIDString, 10)
			const tsResource = timestampResources[ObjectID]
			if (tsResource === undefined) return null
			return {
				ObjectID,
				ObjectVersion,
				Resources: Object.entries(Resources).reduce(
					(Resources, [k, v]) => ({
						...Resources,
						[k]:
							typeof v === 'number' && parseInt(k, 10) === tsResource
								? new Date(v)
								: v,
					}),
					{},
				),
			}
		})
		.filter((o) => o !== null) as LwM2MObject[]
