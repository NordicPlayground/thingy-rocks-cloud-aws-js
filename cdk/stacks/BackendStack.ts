import {
	App,
	CfnOutput,
	aws_dynamodb as DynamoDB,
	Fn,
	aws_lambda as Lambda,
	Stack,
} from 'aws-cdk-lib'
import type { BackendLambdas } from '../BackendLambdas.js'
import type { PackedLayer } from '../packLayer.js'
import { Map } from '../resources/Map.js'
import { PublishSummaries } from '../resources/PublishSummaries.js'
import { ResolveCellLocation } from '../resources/ResolveCellLocation.js'
import { ResolveNetworkSurveyGeoLocation } from '../resources/ResolveNetworkSurveyGeoLocation.js'
import { UserAuthentication } from '../resources/UserAuthentication.js'
import { WebsocketAPI } from '../resources/WebsocketAPI.js'
import { Wirepas5GMeshGateway } from '../resources/Wirepas5GMeshGateway.js'
import { STACK_NAME } from './stackName.js'
import { NRPlusGateway } from '../resources/NRPlusGateway.js'
import { LwM2M } from '../resources/LwM2M.js'

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
			cellGeoStateMachineARN: `arn:aws:states:${this.region}:${this.account}:stateMachine:${assetTrackerStackName}-cellGeo`,
		})

		new ResolveNetworkSurveyGeoLocation(this, {
			lambdaSources,
			baseLayer,
			networkSurveyGeolocationApiUrl: Fn.importValue(
				`${assetTrackerStackName}:networkSurveyGeolocationApiUrl`,
			),
			websocketAPI: api,
			surveysTable: DynamoDB.Table.fromTableAttributes(this, 'surveysTable', {
				tableArn: Fn.importValue(
					`${assetTrackerStackName}:networkSurveyStorageTableArn`,
				),
				tableStreamArn: Fn.importValue(
					`${assetTrackerStackName}:networkSurveyStorageTableStreamArn`,
				),
			}),
			networkSurveyGeoStateMachineARN: `arn:aws:states:${this.region}:${this.account}:stateMachine:${assetTrackerStackName}-networkSurveyGeo`,
		})

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

		new NRPlusGateway(this, {
			lambdaSources,
		})

		new LwM2M(this, {
			lambdaSources,
			baseLayer,
		})

		const wirepasGateway = new Wirepas5GMeshGateway(this, { websocketAPI: api })

		// Outputs
		new CfnOutput(this, 'WebSocketURI', {
			exportName: `${this.stackName}:WebSocketURI`,
			description: 'The WSS Protocol URI to connect to',
			value: api.websocketURI,
		})

		new CfnOutput(this, 'WebSocketManagementApiURL', {
			exportName: `${this.stackName}:WebSocketManagementApiURL`,
			value: api.websocketManagementAPIURL,
		})

		new CfnOutput(this, 'connectionsTableName', {
			exportName: `${this.stackName}:connectionsTableName`,
			value: api.connectionsTable.tableName,
		})

		new CfnOutput(this, 'mapName', {
			value: map.map.mapName,
			exportName: `${this.stackName}:mapName`,
		})

		new CfnOutput(this, 'identityPoolId', {
			value: userAuthentication.identityPool.ref,
			exportName: `${this.stackName}:identityPoolId`,
		})

		new CfnOutput(this, 'wirepasGatewayUserAccessKeyId', {
			value: wirepasGateway.accessKey.ref,
			exportName: `${this.stackName}:wirepasGatewayUserAccessKeyId`,
		})

		new CfnOutput(this, 'wirepasGatewayUserSecretAccessKey', {
			value: wirepasGateway.accessKey.attrSecretAccessKey,
			exportName: `${this.stackName}:wirepasGatewayUserSecretAccessKey`,
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
