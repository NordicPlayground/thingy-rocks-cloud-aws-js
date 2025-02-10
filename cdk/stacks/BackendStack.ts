import { repositoryName } from '@bifravst/aws-cdk-ecr-helpers/repository'
import type { PackedLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import type { App, Environment } from 'aws-cdk-lib'
import {
	CfnOutput,
	aws_dynamodb as DynamoDB,
	aws_ecr as ECR,
	aws_ecs as ECS,
	Fn,
	aws_lambda as Lambda,
	Stack,
} from 'aws-cdk-lib'
import { ContainerRepositoryId } from '../../aws/ecr.ts'
import type { BackendLambdas } from '../BackendLambdas.ts'
import { CoAPEndpoint } from '../resources/CoAPEndpoint.ts'
import { LwM2M } from '../resources/LwM2M.ts'
import { Map } from '../resources/Map.ts'
import { Memfault } from '../resources/Memfault.ts'
import { PublishSummaries } from '../resources/PublishSummaries.ts'
import { ResolveCellLocation } from '../resources/ResolveCellLocation.ts'
import { ResolveNetworkSurveyGeoLocation } from '../resources/ResolveNetworkSurveyGeoLocation.ts'
import { UserAuthentication } from '../resources/UserAuthentication.ts'
import { WebsocketAPI } from '../resources/WebsocketAPI.ts'
import { STACK_NAME } from './stackName.ts'

export class BackendStack extends Stack {
	public constructor(
		parent: App,
		{
			lambdaSources,
			layer,
			assetTrackerStackName,
			coAPEndpointContainerTag,
			env,
		}: {
			lambdaSources: BackendLambdas
			layer: PackedLayer
			assetTrackerStackName: string
			coAPEndpointContainerTag: string
			env: Required<Environment>
		},
	) {
		super(parent, STACK_NAME, {
			env,
		})

		const baseLayer = new Lambda.LayerVersion(this, 'baseLayer', {
			layerVersionName: `${Stack.of(this).stackName}-baseLayer`,
			code: Lambda.Code.fromAsset(layer.layerZipFilePath),
			compatibleArchitectures: [Lambda.Architecture.ARM_64],
			compatibleRuntimes: [Lambda.Runtime.NODEJS_20_X],
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

		new LwM2M(this, {
			lambdaSources,
			baseLayer,
		})

		new Memfault(this, {
			assetTrackerStackName,
			baseLayer,
			lambdaSources,
			websocketAPI: api,
		})

		const coapEndpoint = new CoAPEndpoint(this, {
			image: ECS.ContainerImage.fromEcrRepository(
				ECR.Repository.fromRepositoryName(
					this,
					'coap-endpoint-ecr',
					repositoryName({
						stackName: Stack.of(this).stackName,
						id: ContainerRepositoryId.CoAPEndpoint,
					}),
				),
				coAPEndpointContainerTag,
			),
		})

		new CfnOutput(this, 'coAPEndpointPublicIP', {
			exportName: `${this.stackName}:coAPEndpoint`,
			description: 'The DNS name of the CoAP endpoint',
			value: coapEndpoint.service.loadBalancer.loadBalancerDnsName,
		})

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
	}
}

export type StackOutputs = {
	WebSocketURI: string
	firmwareCIUserAccessKeyId: string
	firmwareCIUserSecretAccessKey: string
	mapName: string
	identityPoolId: string
}
