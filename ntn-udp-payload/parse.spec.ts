import {
	LwM2MObjectID,
	type BatteryAndPower_14202,
	type ConnectionInformation_14203,
	type DeviceInformation_14204,
	type Environment_14205,
	type Geolocation_14201,
} from '@hello.nrfcloud.com/proto-map/lwm2m'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { findLwM2MObject } from './isNotEmpty.ts'
import { parse } from './parse.ts'

void describe('parse()', () => {
	void it('should parse UDP payload into LwM2M objects', () => {
		const example =
			'359404230235476,,474,48,20,2,24201,61.366418,5.558781,10,84.00,24.68,100.06,18.71'

		const now = new Date()
		const ts = Math.floor(now.getTime() / 1000)

		const result = parse(example, now)

		const deviceInfo: DeviceInformation_14204 = {
			ObjectID: LwM2MObjectID.DeviceInformation_14204,
			ObjectVersion: '1.0',
			Resources: {
				0: '359404230235476',
				// 1: SIM ICCID ?
				2: '0.0.0-development', // Modem firmware version
				3: '0.0.0-development', // Application firmware version
				4: 'keysight_demo',
				99: ts,
			},
		}

		const connectionInfo: ConnectionInformation_14203 = {
			ObjectID: LwM2MObjectID.ConnectionInformation_14203,
			ObjectVersion: '1.0',
			Resources: {
				0: 'NTN',
				1: 20, // Band
				2: -92, // RSRP is -140+reported value. So 48 =-140+48 = -92
				5: 24201, // Mobile country code and mobile network code,
				99: ts,
			},
		}

		const geolocation: Geolocation_14201 = {
			ObjectID: LwM2MObjectID.Geolocation_14201,
			ObjectVersion: '1.0',
			Resources: {
				0: 61.366418, // Latitude
				1: 5.558781, // Longitude
				3: 10, // Radius
				6: 'GNSS', // Source
				99: ts,
			},
		}

		const env: Environment_14205 = {
			ObjectID: LwM2MObjectID.Environment_14205,
			ObjectVersion: '1.0',
			Resources: {
				0: 24.68, // Temperature
				1: 18.71, // Humidity
				2: 100.06, // Pressure
				99: ts,
			},
		}

		const battery: BatteryAndPower_14202 = {
			ObjectID: LwM2MObjectID.BatteryAndPower_14202,
			ObjectVersion: '1.0',
			Resources: {
				0: 84.0, // State of charge
				99: ts,
			},
		}

		assert.deepEqual(
			findLwM2MObject(result, LwM2MObjectID.DeviceInformation_14204),
			deviceInfo,
			'It should parse the device info',
		)
		assert.deepEqual(
			findLwM2MObject(result, LwM2MObjectID.ConnectionInformation_14203),
			connectionInfo,
			'It should parse the connection info',
		)
		assert.deepEqual(
			findLwM2MObject(result, LwM2MObjectID.Geolocation_14201),
			geolocation,
			'It should parse the geolocation',
		)
		assert.deepEqual(
			findLwM2MObject(result, LwM2MObjectID.Environment_14205),
			env,
			'It should parse the environment',
		)
		assert.deepEqual(
			findLwM2MObject(result, LwM2MObjectID.BatteryAndPower_14202),
			battery,
			'It should parse the battery',
		)
	})

	void it('should detect skylo', () => {
		const example =
			'359404230235476,,474,48,20,2,90198,61.366418,5.558781,10,84.00,24.68,100.06,18.71'

		const result = parse(example)

		assert.equal(
			findLwM2MObject(result, LwM2MObjectID.DeviceInformation_14204)
				?.Resources[4],
			'skylo_demo',
		)
	})
})
