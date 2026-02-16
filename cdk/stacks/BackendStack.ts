import type { PackedLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import type { App } from 'aws-cdk-lib'
import {
	CfnOutput,
	aws_dynamodb as DynamoDB,
	Fn,
	aws_lambda as Lambda,
	Stack,
} from 'aws-cdk-lib'
import type { BackendLambdas } from '../BackendLambdas.ts'
import { IotLifeCycleEvents } from '../resources/IotLifeCycleEvents.ts'
import { LwM2M } from '../resources/LwM2M.ts'
import { LwM2MDataGateway } from '../resources/LwM2MDataGateway.ts'
import { LwM2MObjectsHistory } from '../resources/LwM2MObjectsHistory.ts'
import { Memfault } from '../resources/Memfault.ts'
import { NRPlusGateway } from '../resources/NRPlusGateway.ts'
import { PublishSummaries } from '../resources/PublishSummaries.ts'
import { ResolveCellLocation } from '../resources/ResolveCellLocation.ts'
import { ResolveCellLocationFromLwM2M } from '../resources/ResolveCellLocationFromLwM2M.ts'
import { ResolveNetworkSurveyGeoLocation } from '../resources/ResolveNetworkSurveyGeoLocation.ts'
import { WebsocketAPI } from '../resources/WebsocketAPI.ts'
import { Wirepas5GMeshGateway } from '../resources/Wirepas5GMeshGateway.ts'
import { STACK_NAME } from './stackName.ts'

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
			layerVersionName: `${Stack.of(this).stackName}-baseLayer`,
			code: Lambda.Code.fromAsset(layer.layerZipFilePath),
			compatibleArchitectures: [Lambda.Architecture.ARM_64],
			compatibleRuntimes: [Lambda.Runtime.NODEJS_24_X],
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

		new ResolveCellLocationFromLwM2M(this, {
			lambdaSources,
			baseLayer,
			geolocationApiUrl: Fn.importValue(
				`${assetTrackerStackName}:geolocationApiUrl`,
			),
			websocketAPI: api,
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

		/**
		 * This is the history of LwM2M shadow updates.
		 */
		const lwM2MHistory = new LwM2MObjectsHistory(this, {
			lambdaSources,
			layers: [baseLayer],
		})

		new PublishSummaries(this, {
			lambdaSources,
			baseLayer,
			websocketAPI: api,
			lwM2MHistory,
			// This references the historical data table from the asset tracker stack, which is not yet using LwM2M to encode the data
			historicaldataTableInfo: Fn.importValue(
				`${assetTrackerStackName}:historicaldataTableInfo`,
			),
			historicaldataTableArn: Fn.importValue(
				`${assetTrackerStackName}:historicaldataTableArn`,
			),
		})

		new NRPlusGateway(this, {
			lambdaSources,
			layer: baseLayer,
		})

		new LwM2M(this, {
			lambdaSources,
			baseLayer,
		})

		const wirepasGateway = new Wirepas5GMeshGateway(this)

		const memfault = new Memfault(this, {
			assetTrackerStackName,
			baseLayer,
			lambdaSources,
			websocketAPI: api,
		})

		const lwm2mgw = new LwM2MDataGateway(this, {
			lambdaSources,
			baseLayer,
			websocketAPI: api,
		})

		new CfnOutput(this, 'thingPolicyArn', {
			value: lwm2mgw.thingPolicy.attrArn,
			exportName: `${this.stackName}:thingPolicyArn`,
			description: 'Thingy policy for LwM2M data gateways',
		})

		new IotLifeCycleEvents(this)

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

		new CfnOutput(this, 'WebSocketManagementApiARN', {
			exportName: `${this.stackName}:WebSocketManagementApiARN`,
			value: api.websocketAPIArn,
		})

		new CfnOutput(this, 'connectionsTableName', {
			exportName: `${this.stackName}:connectionsTableName`,
			value: api.connectionsTable.tableName,
		})

		new CfnOutput(this, 'wirepasGatewayUserAccessKeyId', {
			value: wirepasGateway.accessKey.ref,
			exportName: `${this.stackName}:wirepasGatewayUserAccessKeyId`,
		})

		new CfnOutput(this, 'wirepasGatewayUserSecretAccessKey', {
			value: wirepasGateway.accessKey.attrSecretAccessKey,
			exportName: `${this.stackName}:wirepasGatewayUserSecretAccessKey`,
		})

		new CfnOutput(this, 'memfaultBucketURL', {
			value: `https://${memfault.bucket.bucketDomainName}/`,
			exportName: `${this.stackName}:memfaultBucketURL`,
		})
	}
}

export type StackOutputs = {
	WebSocketURI: string
	firmwareCIUserAccessKeyId: string
	firmwareCIUserSecretAccessKey: string
}
