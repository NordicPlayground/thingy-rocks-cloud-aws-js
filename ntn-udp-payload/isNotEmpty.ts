import type {
	LwM2MObjectID,
	LwM2MObjectInstance,
} from '@hello.nrfcloud.com/proto-map/lwm2m'

export const findLwM2MObject = (
	objects: Array<LwM2MObjectInstance> | undefined,
	objectID: LwM2MObjectID,
): LwM2MObjectInstance | undefined =>
	(objects ?? []).find((o) => o.ObjectID === objectID)
