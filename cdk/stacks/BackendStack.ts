import {
	App,
	aws_dynamodb as DynamoDB,
	aws_lambda as Lambda,
	CfnOutput,
	Fn,
	Stack,
} from 'aws-cdk-lib'
import type { PackedLayer } from '../packLayer.js'
import { FirmwareCI } from '../resources/FirmwareCI.js'
import { Map } from '../resources/Map.js'
import { PublishSummaries } from '../resources/PublishSummaries.js'
import { ResolveCellLocation } from '../resources/ResolveCellLocation.js'
import { ResolveNcellmeasGeoLocation } from '../resources/ResolveNcellmeasGeoLocation.js'
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
			lambdaSources: BackendLambdas
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
			geolocationApiUrl: Fn.importValue(
				`${assetTrackerStackName}:geolocationApiUrl`,
			),
			websocketAPI: api,
			cellGeoStateMachineARN: `arn:aws:states:${parent.region}:${parent.account}:stateMachine:${assetTrackerStackName}-cellGeo`,
		})

		new ResolveNcellmeasGeoLocation(this, {
			lambdaSources,
			baseLayer,
			neighborCellGeolocationApiUrl: Fn.importValue(
				`${assetTrackerStackName}:neighborCellGeolocationApiUrl`,
			),
			websocketAPI: api,
			reportsTable: DynamoDB.Table.fromTableAttributes(this, 'reportsTable', {
				tableArn: Fn.importValue(
					`${assetTrackerStackName}:ncellmeasStorageTableArn`,
				),
				tableStreamArn: Fn.importValue(
					`${assetTrackerStackName}:ncellmeasStorageTableStreamArn`,
				),
			}),
			ncellmeasGeoStateMachineARN: `arn:aws:states:${parent.region}:${parent.account}:stateMachine:${assetTrackerStackName}-ncellmeasGeo`,
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
			websocketAPI: api,
			historicaldataTableInfo: Fn.importValue(
				`${assetTrackerStackName}:historicaldataTableInfo`,
			),
			historicaldataTableArn: Fn.importValue(
				`${assetTrackerStackName}:historicaldataTableArn`,
			),
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
