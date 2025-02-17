import {
	LwM2MObjectID,
	type BatteryAndPower_14202,
	type ConnectionInformation_14203,
	type DeviceInformation_14204,
	type Environment_14205,
	type Geolocation_14201,
	type LwM2MObjectInstance,
} from '@hello.nrfcloud.com/proto-map/lwm2m'

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
): Array<LwM2MObjectInstance> => {
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
	] = payload.split(',')

	void ping, ue_mode

	const tsInSeconds = isNotEmpty(ts)
		? parseInt(ts, 10)
		: Math.floor(now.getTime() / 1000)

	const objects: Array<LwM2MObjectInstance> = []

	if (!isNotEmpty(imei)) return []

	const deviceInfo: DeviceInformation_14204 = {
		ObjectID: LwM2MObjectID.DeviceInformation_14204,
		ObjectVersion: '1.0',
		Resources: {
			0: imei,
			// 1: SIM ICCID ?
			2: '0.0.0-development', // Modem firmware version
			3: '0.0.0-development', // Application firmware version
			4: 'thingy91x',
			99: tsInSeconds,
		},
	}

	objects.push(deviceInfo)

	if (isNotEmpty(band) && isNotEmpty(rsrp) && isNotEmpty(operator)) {
		const connectionInfo: ConnectionInformation_14203 = {
			ObjectID: LwM2MObjectID.ConnectionInformation_14203,
			ObjectVersion: '1.0',
			Resources: {
				0: 'NTN',
				1: parseInt(band, 10),
				2: -140 + parseInt(rsrp, 10),
				5: parseInt(operator, 10),
				99: tsInSeconds,
			},
		}
		objects.push(connectionInfo)
	}

	if (isNotEmpty(latitude) && isNotEmpty(longitude) && isNotEmpty(accuracy)) {
		const geolocation: Geolocation_14201 = {
			ObjectID: LwM2MObjectID.Geolocation_14201,
			ObjectVersion: '1.0',
			Resources: {
				0: parseFloat(latitude),
				1: parseFloat(longitude),
				3: parseFloat(accuracy),
				6: 'GNSS',
				99: tsInSeconds,
			},
		}
		objects.push(geolocation)
	}

	if (isNotEmpty(temp) && isNotEmpty(humidity) && isNotEmpty(pressure)) {
		const env: Environment_14205 = {
			ObjectID: LwM2MObjectID.Environment_14205,
			ObjectVersion: '1.0',
			Resources: {
				0: parseFloat(temp),
				1: parseFloat(humidity),
				2: parseFloat(pressure),
				99: tsInSeconds,
			},
		}
		objects.push(env)
	}

	if (isNotEmpty(battery)) {
		const batteryInfo: BatteryAndPower_14202 = {
			ObjectID: LwM2MObjectID.BatteryAndPower_14202,
			ObjectVersion: '1.0',
			Resources: {
				0: parseFloat(battery),
				99: tsInSeconds,
			},
		}
		objects.push(batteryInfo)
	}

	return objects
}

const isNotEmpty = (value: unknown): value is string =>
	typeof value === 'string' && value.length > 0
