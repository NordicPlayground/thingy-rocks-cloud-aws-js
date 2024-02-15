import {
	Duration,
	aws_events_targets as EventTargets,
	aws_events as Events,
	aws_iam as IAM,
	aws_iot as IoT,
	aws_lambda as Lambda,
	Stack,
	aws_logs as Logs,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { PackedLambda } from '../backend.js'
import type { WebsocketAPI } from './WebsocketAPI.js'

export class ResolveCellLocation extends Construct {
	public constructor(
		parent: Construct,
		{
			lambdaSources,
			baseLayer,
			geolocationApiUrl,
			websocketAPI,
			cellGeoStateMachineARN,
		}: {
			lambdaSources: {
				resolveCellLocation: PackedLambda
				onCellGeoLocationResolved: PackedLambda
			}
			baseLayer: Lambda.ILayerVersion
			geolocationApiUrl: string
			websocketAPI: WebsocketAPI
			cellGeoStateMachineARN: string
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
				runtime: Lambda.Runtime.NODEJS_20_X,
				timeout: Duration.seconds(60),
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
					new IAM.PolicyStatement({
						actions: ['iot:DescribeThing'],
						resources: ['*'],
					}),
				],
				logRetention: Logs.RetentionDays.ONE_WEEK,
			},
		)

		websocketAPI.connectionsTable.grantFullAccess(resolveCellLocation)

		const resolveCellLocationRuleRole = new IAM.Role(
			this,
			'resolveCellLocationRuleRole',
			{
				assumedBy: new IAM.ServicePrincipal(
					'iot.amazonaws.com',
				) as IAM.IPrincipal,
				inlinePolicies: {
					rootPermissions: new IAM.PolicyDocument({
						statements: [
							new IAM.PolicyStatement({
								actions: ['iot:Publish'],
								resources: [
									`arn:aws:iot:${Stack.of(parent).region}:${
										Stack.of(parent).account
									}:topic/errors`,
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
						`topic(3) as deviceId`,
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
				principal: new IAM.ServicePrincipal(
					'iot.amazonaws.com',
				) as IAM.IPrincipal,
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
				runtime: Lambda.Runtime.NODEJS_20_X,
				timeout: Duration.seconds(60),
				memorySize: 1792,
				code: Lambda.Code.fromAsset(
					lambdaSources.onCellGeoLocationResolved.lambdaZipFile,
				),
				description: 'Publish cell geolocation resolutions',
				environment: {
					VERSION: this.node.tryGetContext('version'),
					CONNECTIONS_TABLE_NAME: websocketAPI.connectionsTable.tableName,
					WEBSOCKET_MANAGEMENT_API_URL: websocketAPI.websocketManagementAPIURL,
				},
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['execute-api:ManageConnections'],
						resources: [websocketAPI.websocketAPIArn],
					}),
					new IAM.PolicyStatement({
						actions: ['iot:SearchIndex', 'iot:UpdateThingShadow'],
						resources: ['*'],
					}),
				],
				layers: [baseLayer],
				logRetention: Logs.RetentionDays.ONE_WEEK,
			},
		)
		websocketAPI.connectionsTable.grantFullAccess(onCellGeoLocationResolved)

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
						stateMachineArn: [cellGeoStateMachineARN],
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
				) as IAM.IPrincipal,
				sourceArn: publishCellGeolocationSuccessEventsRule.ruleArn,
			},
		)
	}
}
