import {
	LwM2MObjectID,
	type BatteryAndPower_14202,
	type ConnectionInformation_14203,
	type ConnectionQuality_14501,
	type DeviceInformation_14204,
	type Environment_14205,
	type Geolocation_14201,
	type LwM2MObjectInstance,
} from '@hello.nrfcloud.com/proto-map/lwm2m'

const isNonEmpty = (s?: string): s is string =>
	s !== undefined && typeof s === 'string' && s !== ''
const toInt = (s?: string): number | null => {
	const n = isNonEmpty(s) ? parseInt(s, 10) : null
	if (n === null) return null
	if (isNaN(n)) return null
	return n
}
const notEmptyString = (s?: string): string | null => (isNonEmpty(s) ? s : null)
const toFloat = (s?: string): number | null => {
	const f = isNonEmpty(s) ? parseFloat(s) : null
	if (f === null) return null
	if (isNaN(f)) return null
	return f
}
/**
 * Parse simple UDP payload into LwM2M objects.
 *
 * Example input: "359404230235476,,474,48,20,2,24201,61.366418,5.558781,10,84.00,24.68,100.06,18.71"
 * Format: "IMEI, ts?, ping, rsrp, band, ue_mode, operator, latitude, longitude,accuracy,battery?, temp?, pressure?, humidity?."
 *
 * If battery or environmental data is not available, the corresponding fields will be left empty.
 */
export const parse = (
	payload: string,
	now = new Date(),
): Array<LwM2MObjectInstance> | null => {
	const parts = payload.split(',')
	const [
		imei,
		ts,
		// TODO: add new LwM2M object for connection statistics.
		ping, // latency in milliseconds
		rsrp,
		band,
		// TODO: ue_mode: 2 ?
		ue_mode,
		operator,
		latitude,
		longitude,
		accuracy,
		battery,
		temp,
		pressure,
		humidity,
	] = [
		notEmptyString(parts[0]), // imei
		toInt(parts[1]), // ts
		toInt(parts[2]), // ping
		toInt(parts[3]), // rsrp
		toInt(parts[4]), // band
		toInt(parts[5]), // ue_mode
		toInt(parts[6]), // operator
		toFloat(parts[7]), // latitude
		toFloat(parts[8]), // longitude
		toFloat(parts[9]), // accuracy
		toFloat(parts[10]), // battery
		toFloat(parts[11]), // temp
		toFloat(parts[12]), //  pressure
		toFloat(parts[13]), //  humidity
	]

	void ue_mode

	const tsInSeconds = ts ?? Math.floor(now.getTime() / 1000)

	if (imei === null) return null
	if (!/^[0-9]{15,}/.test(imei)) return null

	const objects: Array<LwM2MObjectInstance> = []

	const deviceInfo: DeviceInformation_14204 = {
		ObjectID: LwM2MObjectID.DeviceInformation_14204,
		ObjectVersion: '1.0',
		Resources: {
			0: imei,
			// 1: SIM ICCID ?
			2: '0.0.0-development', // Modem firmware version
			3: '0.0.0-development', // Application firmware version
			4: operator === 90198 ? 'skylo_demo' : 'keysight_demo',
			99: tsInSeconds,
		},
	}

	objects.push(deviceInfo)

	if (band !== null && rsrp !== null && operator !== null) {
		const connectionInfo: ConnectionInformation_14203 = {
			ObjectID: LwM2MObjectID.ConnectionInformation_14203,
			ObjectVersion: '1.0',
			Resources: {
				0: 'NTN',
				1: band,
				2: -140 + rsrp,
				5: operator,
				99: tsInSeconds,
			},
		}
		objects.push(connectionInfo)
	}

	if (latitude !== null && longitude !== null && accuracy !== null) {
		const geolocation: Geolocation_14201 = {
			ObjectID: LwM2MObjectID.Geolocation_14201,
			ObjectVersion: '1.0',
			Resources: {
				0: latitude,
				1: longitude,
				3: accuracy,
				6: 'GNSS',
				99: tsInSeconds,
			},
		}
		objects.push(geolocation)
	}

	if (temp !== null && humidity !== null && pressure !== null) {
		const env: Environment_14205 = {
			ObjectID: LwM2MObjectID.Environment_14205,
			ObjectVersion: '1.0',
			Resources: {
				0: temp,
				1: humidity,
				2: pressure,
				99: tsInSeconds,
			},
		}
		objects.push(env)
	}

	if (battery !== null) {
		const batteryInfo: BatteryAndPower_14202 = {
			ObjectID: LwM2MObjectID.BatteryAndPower_14202,
			ObjectVersion: '1.0',
			Resources: {
				0: battery,
				99: tsInSeconds,
			},
		}
		objects.push(batteryInfo)
	}

	if (ping !== null) {
		const connectionQuality: ConnectionQuality_14501 = {
			ObjectID: LwM2MObjectID.ConnectionQuality_14501,
			ObjectVersion: '1.0',
			Resources: {
				0: ping,
				99: tsInSeconds,
			},
		}
		objects.push(connectionQuality)
	}

	return objects
}
