import { GetParametersByPathCommand, SSMClient } from '@aws-sdk/client-ssm'

export const createAPIClient = async (
	ssm: SSMClient,
	stackName: string,
): Promise<{
	getLastReboots: (deviceId: string) => Promise<null | Array<Reboot>>
}> => {
	const Prefix = `/${stackName}/memfault/`

	const { organizationAuthToken, organizationId, projectId } = (
		(
			await ssm.send(
				new GetParametersByPathCommand({
					Path: Prefix,
				}),
			)
		)?.Parameters ?? []
	).reduce(
		(params, p) => ({
			...params,
			[(p.Name ?? '').replace(Prefix, '')]: p.Value ?? '',
		}),
		{} as Record<string, string>,
	)

	if (
		organizationAuthToken === undefined ||
		organizationId === undefined ||
		projectId === undefined
	)
		throw new Error(`Memfault settings not configured!`)

	return {
		getLastReboots: async (deviceId) => {
			const res = await fetch(
				`https://api.memfault.com/api/v0/organizations/${organizationId}/projects/${projectId}/devices/${deviceId}/reboots?${new URLSearchParams(
					{
						since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
					},
				).toString()}`,
				{
					headers: new Headers({
						Authorization: `Basic ${Buffer.from(`:${organizationAuthToken}`).toString('base64')}`,
					}),
				},
			)
			if (!res.ok) return null
			return (await res.json()).data
		},
	}
}

export type Reboot = {
	type: 'memfault'
	mcu_reason_register: null
	time: string // e.g. '2024-03-14T07:26:37.270000+00:00'
	reason: number // e.g. 7
	software_version: {
		version: string // e.g. '1.11.1+thingy91.low-power.memfault'
		id: number // e.g.504765
		software_type: {
			id: number //e.g. 32069;
			name: string // e.g. 'thingy_world'
		}
		archived: boolean
	}
}
