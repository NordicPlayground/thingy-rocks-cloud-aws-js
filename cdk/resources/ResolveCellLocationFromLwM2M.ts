import {
	LambdaLogGroup,
	LambdaSource,
} from '@bifravst/aws-cdk-lambda-helpers/cdk'
import {
	Duration,
	aws_iam as IAM,
	aws_iot as IoT,
	aws_lambda as Lambda,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../BackendLambdas.ts'
import type { WebsocketAPI } from './WebsocketAPI.ts'

export class ResolveCellLocationFromLwM2M extends Construct {
	public constructor(
		parent: Construct,
		{
			lambdaSources,
			baseLayer,
			geolocationApiUrl,
			websocketAPI,
		}: {
			lambdaSources: Pick<
				BackendLambdas,
				'resolveCellLocationFromLwM2M' | 'onCellGeoLocationResolved'
			>
			baseLayer: Lambda.ILayerVersion
			geolocationApiUrl: string
			websocketAPI: WebsocketAPI
		},
	) {
		super(parent, ResolveCellLocationFromLwM2M.name)

		const resolveCellLocationFromLwM2M = new Lambda.Function(
			this,
			'resolveCellLocationFromLwM2M',
			{
				handler: lambdaSources.resolveCellLocationFromLwM2M.handler,
				architecture: Lambda.Architecture.ARM_64,
				runtime: Lambda.Runtime.NODEJS_24_X,
				timeout: Duration.seconds(60),
				memorySize: 1792,
				code: new LambdaSource(this, lambdaSources.resolveCellLocationFromLwM2M)
					.code,
				description:
					'Invoked when devices report their cell location via LwM2M',
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
					new IAM.PolicyStatement({
						actions: ['iot:UpdateThingShadow'],
						resources: ['*'],
					}),
				],
				...new LambdaLogGroup(this, 'resolveCellLocationFromLwM2MLogs'),
			},
		)

		websocketAPI.connectionsTable.grantFullAccess(resolveCellLocationFromLwM2M)

		const resolveCellLocationRuleRole = new IAM.Role(
			this,
			'resolveCellLocationRuleRole',
			{
				assumedBy: new IAM.ServicePrincipal('iot.amazonaws.com'),
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
						`SELECT`,
						`get(get(current.state.reported, '14203:1.0'), '0') AS connectionInformation,`,
						`get(get(current.state.reported, '14201:1.0'), '2') AS scellLocation,`,
						`topic(3) as deviceId`,
						`FROM '$aws/things/+/shadow/name/lwm2m/update/documents'`,
						`WHERE`,
						`isUndefined(get(get(current.state.reported, '14203:1.0'), '0')) = false`,
					].join(' '),
					actions: [
						{
							lambda: {
								functionArn: resolveCellLocationFromLwM2M.functionArn,
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

		resolveCellLocationFromLwM2M.addPermission(
			'invokeByResolveCellLocationRulePermission',
			{
				principal: new IAM.ServicePrincipal('iot.amazonaws.com'),
				sourceArn: resolveCellLocationRule.attrArn,
			},
		)
	}
}
