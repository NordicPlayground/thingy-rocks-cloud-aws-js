import {
	timestampResources,
	type LwM2MObjectInstance,
} from '@hello.nrfcloud.com/proto-map/lwm2m'

export type LwM2MShadow = Record<
	string,
	Record<number, Record<number, string | number | boolean>>
>

export const objectsToShadow = (
	objects: Array<LwM2MObjectInstance>,
): LwM2MShadow =>
	objects
		.sort((u1, u2) => {
			const tsRes1 =
				u1.Resources[timestampResources.get(u1.ObjectID) ?? -1] ?? -1
			const tsRes2 =
				u2.Resources[timestampResources.get(u2.ObjectID) ?? -1] ?? -1
			return tsRes1 > tsRes2 ? 1 : -1
		})
		.reduce<LwM2MShadow>((shadow, update) => {
			const key = `${update.ObjectID}:${update.ObjectVersion ?? '1.0'}`
			return {
				...shadow,
				[key]: {
					[update.ObjectInstanceID ?? 0]: {
						...(shadow[key] ?? {}),
						...Object.entries(update.Resources).reduce(
							(resources, [k, v]) => ({
								...resources,
								[k]: v,
							}),
							{},
						),
					},
				},
			}
		}, {})
