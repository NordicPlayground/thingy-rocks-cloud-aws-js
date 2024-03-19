import { IoTClient, ListThingsInThingGroupCommand } from '@aws-sdk/client-iot'

export const listThingsInGroup =
	(iot: IoTClient) =>
	async (
		groupName: string,
		nextToken?: string,
		allThings?: Array<string>,
	): Promise<Array<string>> => {
		const { things, nextToken: n } = await iot.send(
			new ListThingsInThingGroupCommand({
				thingGroupName: groupName,
				nextToken,
			}),
		)
		const t = [...(allThings ?? []), ...(things ?? [])]
		if (n === undefined) return t
		return listThingsInGroup(iot)(groupName, n, t)
	}
