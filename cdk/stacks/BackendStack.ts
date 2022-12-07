import { App, aws_lambda as Lambda, CfnOutput, Fn, Stack } from 'aws-cdk-lib'
import type { PackedLambda } from '../backend.js'
import type { PackedLayer } from '../packLayer.js'
import { FirmwareCI } from '../resources/FirmwareCI.js'
import { Map } from '../resources/Map.js'
import { PublishSummaries } from '../resources/PublishSummaries.js'
import { ResolveCellLocation } from '../resources/ResolveCellLocation.js'
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
				resolveCellLocation: PackedLambda
				publishSummaries: PackedLambda
			}
			layer: PackedLayer
			assetTrackerStackName: string
		},
	) {
		super(parent, STACK_NAME)

		const baseLayer = new Lambda.LayerVersion(this, 'baseLayer', {
			code: Lambda.Code.fromAsset(layer.layerZipFile),
			compatibleArchitectures: [Lambda.Architecture.ARM_64],
			compatibleRuntimes: [Lambda.Runtime.NODEJS_18_X],
		})

		const api = new WebsocketAPI(this, {
			lambdaSources,
			baseLayer,
		})

		new ResolveCellLocation(this, {
			lambdaSources,
			baseLayer,
			assetTrackerStackName,
			geolocationApiUrl: Fn.importValue(
				`${assetTrackerStackName}:geolocationApiUrl`,
			),
			websocketAPI: api,
		})

		const firmwareCI = new FirmwareCI(this)

		const userAuthentication = new UserAuthentication(
			this,
			'userAuthentication',
		)

		const map = new Map(this, 'map', {
			userAuthentication,
		})

		new PublishSummaries(this, {
			lambdaSources,
			baseLayer,
			assetTrackerStackName,
			websocketAPI: api,
		})

		// Outputs
		new CfnOutput(this, 'WebSocketURI', {
			exportName: `${this.stackName}:WebSocketURI`,
			description: 'The WSS Protocol URI to connect to',
			value: api.websocketURI,
		})

		new CfnOutput(this, 'firmwareCIUserAccessKeyId', {
			value: firmwareCI.accessKey.ref,
			exportName: `${this.stackName}:firmwareCIUserAccessKeyId`,
		})

		new CfnOutput(this, 'firmwareCIUserSecretAccessKey', {
			value: firmwareCI.accessKey.attrSecretAccessKey,
			exportName: `${this.stackName}:firmwareCIUserSecretAccessKey`,
		})

		new CfnOutput(this, 'mapName', {
			value: map.map.mapName,
			exportName: `${this.stackName}:mapName`,
		})

		new CfnOutput(this, 'identityPoolId', {
			value: userAuthentication.identityPool.ref,
			exportName: `${this.stackName}:identityPoolId`,
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
