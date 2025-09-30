import cbor from 'cbor'

export type LocationData = {
	lat: number
	lon: number
	uncertainty: number
	src: string
}
export const parseCbor = (cborData: string): LocationData => {
	const buf = Buffer.from(cborData, 'base64')
	const decoded = cbor.decodeAllSync(buf)
	const keyMap: Record<number, string> = {
		1: 'lat',
		2: 'lon',
		3: 'uncertainty',
		4: 'src',
	}

	const cborMap = decoded[0] as Map<number, string | number>
	const formatted = Object.fromEntries(
		Array.from(cborMap.entries())
			.filter(([k]) => k in keyMap)
			.map(([k, v]) => [keyMap[k]!, v]), // `!` since we filtered
	)

	return formatted as LocationData
}
