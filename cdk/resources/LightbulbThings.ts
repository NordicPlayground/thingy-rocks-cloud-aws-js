import {
	aws_iam as IAM,
	aws_iot as IoT,
	aws_lambda as Lambda,
	Duration,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { PackedLambda } from '../backend'
import { LambdaLogGroup } from './LambdaLogGroup'
import type { WebsocketAPI } from './WebsocketAPI'

/**
 * Manage resources needed for the MQTT sample simulating a smart lightbulb
 */
export class LightbulbThings extends Construct {
	constructor(
		parent: Stack,
		{
			lambdaSources,
			baseLayer,
			websocketAPI,
		}: {
			lambdaSources: {
				lightbulbPing: PackedLambda
			}
			baseLayer: Lambda.ILayerVersion
			websocketAPI: WebsocketAPI
		},
	) {
		super(parent, 'LightbulbThings')

		// lightbulbPing

		const lightbulbPing = new Lambda.Function(this, 'lightbulbPing', {
			handler: lambdaSources.lightbulbPing.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.seconds(60),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.lightbulbPing.lambdaZipFile),
			description: 'Invoked when the MQTT sample sends a ping',
			layers: [baseLayer],
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
					actions: ['iot:DescribeThing'],
					resources: ['*'],
				}),
			],
		})

		new LambdaLogGroup(this, 'lightbulbPingLogs', lightbulbPing)

		websocketAPI.connectionsTable.grantFullAccess(lightbulbPing)

		const lightbulbPingRuleRole = new IAM.Role(this, 'lightbulbPingRuleRole', {
			assumedBy: new IAM.ServicePrincipal(
				'iot.amazonaws.com',
			) as IAM.IPrincipal,
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
		})

		const lightbulbPingRule = new IoT.CfnTopicRule(this, 'lightbulbPingRule', {
			topicRulePayload: {
				description: `Send pings to lambda to forward them`,
				ruleDisabled: false,
				awsIotSqlVersion: '2016-03-23',
				sql: [
					// Lambda does not support binary data, must be encoded
					`SELECT encode(*, 'base64') AS message,`,
					`clientid() as deviceId`,
					`FROM 'light-bulb/telemetry'`,
				].join(' '),
				actions: [
					{
						lambda: {
							functionArn: lightbulbPing.functionArn,
						},
					},
				],
				errorAction: {
					republish: {
						roleArn: lightbulbPingRuleRole.roleArn,
						topic: 'errors',
					},
				},
			},
		})

		lightbulbPing.addPermission('invokeBylightbulbPingRulePermission', {
			principal: new IAM.ServicePrincipal(
				'iot.amazonaws.com',
			) as IAM.IPrincipal,
			sourceArn: lightbulbPingRule.attrArn,
		})
	}
}
