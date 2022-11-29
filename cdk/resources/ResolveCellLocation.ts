import {
	aws_dynamodb as DynamoDB,
	aws_events as Events,
	aws_events_targets as EventTargets,
	aws_iam as IAM,
	aws_iot as IoT,
	aws_lambda as Lambda,
	Duration,
	Stack,
} from 'aws-cdk-lib'
import type { IPrincipal } from 'aws-cdk-lib/aws-iam/index.js'
import { Construct } from 'constructs'
import type { PackedLambda } from '../backend.js'
import { LambdaLogGroup } from '../resources/LambdaLogGroup.js'
import type { WebsocketAPI } from './WebsocketAPI.js'

export class ResolveCellLocation extends Construct {
	public constructor(
		parent: Stack,
		{
			lambdaSources,
			baseLayer,
			connectionsTable,
			assetTrackerStackName,
			geolocationApiUrl,
			websocketAPI,
		}: {
			lambdaSources: {
				resolveCellLocation: PackedLambda
				onCellGeoLocationResolved: PackedLambda
			}
			baseLayer: Lambda.ILayerVersion
			connectionsTable: DynamoDB.ITable
			assetTrackerStackName: string
			geolocationApiUrl: string
			websocketAPI: WebsocketAPI
		},
	) {
		super(parent, 'ResolveCellLocation')

		// ResolveCellLocation

		const resolveCellLocation = new Lambda.Function(
			this,
			'resolveCellLocation',
			{
				handler: lambdaSources.resolveCellLocation.handler,
				architecture: Lambda.Architecture.ARM_64,
				runtime: Lambda.Runtime.NODEJS_18_X,
				timeout: Duration.seconds(1),
				memorySize: 1792,
				code: Lambda.Code.fromAsset(
					lambdaSources.resolveCellLocation.lambdaZipFile,
				),
				description: 'Invoked when devices report their cell location',
				layers: [baseLayer],
				environment: {
					VERSION: this.node.tryGetContext('version'),
					CONNECTIONS_TABLE_NAME: websocketAPI.connectionsTable.tableName,
					WEBSOCKET_MANAGEMENT_API_URL: websocketAPI.websocketManagementAPIURL,
					GEOLOCATION_API_URL: geolocationApiUrl,
				},
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['execute-api:ManageConnections'],
						resources: [websocketAPI.websocketAPIArn],
					}),
				],
			},
		)

		new LambdaLogGroup(this, 'resolveCellLocationLogs', resolveCellLocation)

		websocketAPI.connectionsTable.grantReadData(resolveCellLocation)

		const resolveCellLocationRuleRole = new IAM.Role(
			this,
			'resolveCellLocationRuleRole',
			{
				assumedBy: new IAM.ServicePrincipal('iot.amazonaws.com') as IPrincipal,
				inlinePolicies: {
					rootPermissions: new IAM.PolicyDocument({
						statements: [
							new IAM.PolicyStatement({
								actions: ['iot:Publish'],
								resources: [
									`arn:aws:iot:${parent.region}:${parent.account}:topic/errors`,
								],
							}),
						],
					}),
				},
			},
		)

		const resolveCellLocationRule = new IoT.CfnTopicRule(
			this,
			'resolveCellLocationRule',
			{
				topicRulePayload: {
					description: `Send cell location information to a lambda to resolve them`,
					ruleDisabled: false,
					awsIotSqlVersion: '2016-03-23',
					sql: [
						`SELECT current.state.reported.roam AS roam,`,
						`topic(3) as deviceId,`,
						`parse_time("yyyy-MM-dd'T'HH:mm:ss.S'Z'",`,
						`timestamp()) as receivedTimestamp`,
						`FROM '$aws/things/+/shadow/update/documents'`,
						`WHERE`,
						'isUndefined(current.state.reported.roam.v.area) = false',
						'AND isUndefined(current.state.reported.roam.v.mccmnc) = false',
						'AND isUndefined(current.state.reported.roam.v.cell) = false',
						`AND isUndefined(current.state.reported.roam.v.nw) = false`,
					].join(' '),
					actions: [
						{
							lambda: {
								functionArn: resolveCellLocation.functionArn,
							},
						},
					],
					errorAction: {
						republish: {
							roleArn: resolveCellLocationRuleRole.roleArn,
							topic: 'errors',
						},
					},
				},
			},
		)

		resolveCellLocation.addPermission(
			'invokeByResolveCellLocationRulePermission',
			{
				principal: new IAM.ServicePrincipal('iot.amazonaws.com') as IPrincipal,
				sourceArn: resolveCellLocationRule.attrArn,
			},
		)

		// Publish cell geo location resolution results

		const onCellGeoLocationResolved = new Lambda.Function(
			this,
			'onCellGeoLocationResolvedLambda',
			{
				handler: lambdaSources.onCellGeoLocationResolved.handler,
				architecture: Lambda.Architecture.ARM_64,
				runtime: Lambda.Runtime.NODEJS_18_X,
				timeout: Duration.seconds(1),
				memorySize: 1792,
				code: Lambda.Code.fromAsset(
					lambdaSources.onCellGeoLocationResolved.lambdaZipFile,
				),
				description: 'Publish cell geolocation resolutions',
				environment: {
					VERSION: this.node.tryGetContext('version'),
					CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
				},
				initialPolicy: [],
				layers: [baseLayer],
			},
		)
		connectionsTable.grantReadData(onCellGeoLocationResolved)

		new LambdaLogGroup(
			this,
			'onCellGeoLocationResolvedLogGroup',
			onCellGeoLocationResolved,
		)

		const publishCellGeolocationSuccessEventsRule = new Events.Rule(
			this,
			'publishCellGeolocationSuccessEventsRule',
			{
				description:
					'Invokes a lambda on success results from the Cell Geolocation StepFunction',
				eventPattern: {
					source: ['aws.states'],
					detailType: ['Step Functions Execution Status Change'],
					detail: {
						status: ['SUCCEEDED'],
						stateMachineArn: [
							`arn:aws:states:${parent.region}:${parent.account}:stateMachine:${assetTrackerStackName}-cellGeo`,
						],
					},
				},
				targets: [new EventTargets.LambdaFunction(onCellGeoLocationResolved)],
			},
		)

		onCellGeoLocationResolved.addPermission(
			'invokeByPublishCellGeolocationSuccessEventsRulePermission',
			{
				principal: new IAM.ServicePrincipal(
					'events.amazonaws.com',
				) as IPrincipal,
				sourceArn: publishCellGeolocationSuccessEventsRule.ruleArn,
			},
		)
	}
}
