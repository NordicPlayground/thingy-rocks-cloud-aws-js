import { App, CfnOutput, Stack } from 'aws-cdk-lib'
import type { PackedLambda } from '../packLambda.js'
import type { PackedLayer } from '../packLayer.js'
import { FirmwareCI } from '../resources/FirmwareCI.js'
import { WebsocketAPI } from '../resources/WebsocketAPI.js'
import { STACK_NAME } from './stackName.js'

export class BackendStack extends Stack {
	public constructor(
		parent: App,
		{
			lambdaSources,
			layer,
		}: {
			lambdaSources: {
				publishToWebsocketClients: PackedLambda
				onConnect: PackedLambda
				onMessage: PackedLambda
				onDisconnect: PackedLambda
			}
			layer: PackedLayer
		},
	) {
		super(parent, STACK_NAME)

		const api = new WebsocketAPI(this, {
			lambdaSources,
			layer,
		})

		const firmwareCI = new FirmwareCI(this)

		// Outputs
		new CfnOutput(this, 'WebSocketURI', {
			exportName: 'WebSocketURI',
			description: 'The WSS Protocol URI to connect to',
			value: api.websocketURI,
		})

		new CfnOutput(this, 'firmwareCIUserAccessKeyId', {
			value: firmwareCI.accessKey.ref,
			exportName: `firmwareCIUserAccessKeyId`,
		})

		new CfnOutput(this, 'firmwareCIUserSecretAccessKey', {
			value: firmwareCI.accessKey.attrSecretAccessKey,
			exportName: `firmwareCIUserSecretAccessKey`,
		})
	}
}

export type StackOutputs = {
	WebSocketURI: string
	firmwareCIUserAccessKeyId: string
	firmwareCIUserSecretAccessKey: string
}
