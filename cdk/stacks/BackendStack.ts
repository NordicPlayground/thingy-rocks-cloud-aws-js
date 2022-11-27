import { App, CfnOutput, Stack } from 'aws-cdk-lib'
import type { PackedLambda } from '../packLambda.js'
import type { PackedLayer } from '../packLayer.js'
import { FirmwareCI } from '../resources/FirmwareCI.js'
import { Map } from '../resources/Map.js'
import { UserAuthentication } from '../resources/UserAuthentication.js'
import { WebsocketAPI } from '../resources/WebsocketAPI.js'
import { STACK_NAME } from './stackName.js'

export class BackendStack extends Stack {
	public constructor(
		parent: App,
		{
			lambdaSources,
			layer,
			assetTrackerStackName,
		}: {
			lambdaSources: {
				publishToWebsocketClients: PackedLambda
				onConnect: PackedLambda
				onMessage: PackedLambda
				onDisconnect: PackedLambda
				onCellGeoLocationResolved: PackedLambda
			}
			layer: PackedLayer
			assetTrackerStackName: string
		},
	) {
		super(parent, STACK_NAME)

		const api = new WebsocketAPI(this, {
			lambdaSources,
			layer,
			assetTrackerStackName,
		})

		const firmwareCI = new FirmwareCI(this)

		const userAuthentication = new UserAuthentication(
			this,
			'userAuthentication',
		)

		const map = new Map(this, 'map', {
			userAuthentication
		})

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

		new CfnOutput(this, 'mapName', {
			value: map.map.mapName,
			exportName: 'mapName',
		})

		new CfnOutput(this, 'identityPoolId', {
			value: userAuthentication.identityPool.ref,
			exportName: 'identityPoolId',
		})
	}
}

export type StackOutputs = {
	WebSocketURI: string
	firmwareCIUserAccessKeyId: string
	firmwareCIUserSecretAccessKey: string
	mapName: string
	identityPoolId: string
}
