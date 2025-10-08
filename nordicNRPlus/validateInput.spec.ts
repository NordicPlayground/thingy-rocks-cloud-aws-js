import { Value } from '@sinclair/typebox/value'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { inputSchemaLwm2mMessage } from '../lambda/webhookHandler.ts'

void describe('validateExampleInput', () => {
	const jsonString = `{"type":"device.messages","messages":[{"teamId":"123123","deviceId":"123123","messageId":"b6903898-9998-4767-a7c2-123123123","topic":"$aws/things/123123/shadow/update/documents","message":{"previous":null,"current":{"state":{"desired":{"nrfcloud_mqtt_topic_prefix":"prod/randomTeamId/","pairing":{"state":"paired","topics":{"d2c":"prod/randomNum/m/d/randomNum/d2c","c2d":"prod/123/m/d/123123/+/r"}}}},"metadata":{"desired":{"nrfcloud_mqtt_topic_prefix":{"timestamp":1759240425},"pairing":{"state":{"timestamp":1759240425},"topics":{"d2c":{"timestamp":1759240425},"c2d":{"timestamp":1759240425}}}}},"version":1},"timestamp":1759240425},"receivedAt":"2025-09-30T13:53:45.262Z"}],"timestamp":"2025-10-01T12:23:52.583464498Z"}`
	const parsed = JSON.parse(jsonString)

	void it('valid JSON should pass schema validation', () => {
		const isValid = Value.Check(inputSchemaLwm2mMessage, parsed)
		assert.ok(isValid, 'Expected JSON to match schema')
	})
	void it('invalid JSON should fail schema validation', () => {
		const invalidJson = JSON.parse(
			JSON.stringify({
				type: 'wrong.type',
				messages: [],
				timestamp: '2025-10-01T12:23:52.583Z',
			}),
		)
		const isValid = Value.Check(inputSchemaLwm2mMessage, invalidJson)
		assert.ok(!isValid, 'Expected JSON to fail schema validation')
	})
})
