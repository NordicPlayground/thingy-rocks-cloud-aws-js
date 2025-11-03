export const lastUpdate = (objects: Record<string, any>, maxTs = 0): number => {
	if (typeof objects === 'object' && 'timestamp' in objects) {
		return Math.max(maxTs, objects.timestamp as number)
	}
	for (const key in objects) {
		maxTs = lastUpdate(objects[key], maxTs)
	}
	return maxTs
}
