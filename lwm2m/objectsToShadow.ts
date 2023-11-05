import type { LwM2MObject } from '@hello.nrfcloud.com/proto-lwm2m'

type LwM2MShadow = Record<
	string,
	Record<
		string,
		{
			v: string | number | boolean
			ts: number
		}
	>
>

export const updatesToShadow = (updates: Array<LwM2MObject>): LwM2MShadow =>
	updates
		.sort((u1, u2) => {
			const d1 = Object.values(u1.Resources).find(
				(r) => r instanceof Date,
			) as Date
			const d2 = Object.values(u2.Resources).find(
				(r) => r instanceof Date,
			) as Date
			return d1.getTime() > d2.getTime() ? 1 : -1
		})
		.reduce<LwM2MShadow>((shadow, update) => {
			const ts = (
				Object.values(update.Resources).find((r) => r instanceof Date) as Date
			).getTime()
			const key = `${update.ObjectID}:${update.ObjectVersion ?? '1.0'}`
			return {
				...shadow,
				[key]: {
					...(shadow[key] ?? {}),
					...Object.entries(update.Resources).reduce((resources, [k, v]) => {
						if (v instanceof Date) return resources
						return {
							...resources,
							[k]: {
								v,
								ts,
							},
						}
					}, {}),
				},
			}
		}, {})
