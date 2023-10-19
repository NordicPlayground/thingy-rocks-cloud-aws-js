import { Construct } from 'constructs'
import Iot from 'aws-cdk-lib/aws-iot'
import IAM from 'aws-cdk-lib/aws-iam'
import Logs from 'aws-cdk-lib/aws-logs'
import Lambda from 'aws-cdk-lib/aws-lambda'
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib'
import type { PackedLambda } from '../backend'
import DynamoDB from 'aws-cdk-lib/aws-dynamodb'

export class NRPlusGateway extends Construct {
	constructor(
		parent: Construct,
		{
			lambdaSources,
		}: {
			lambdaSources: {
				parseSinkMessages: PackedLambda
			}
		},
	) {
		super(parent, 'nrplus-gateway')

		const topicRuleRole = new IAM.Role(this, 'topicRule', {
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
		})

		const table = new DynamoDB.Table(this, 'table', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'id',
				type: DynamoDB.AttributeType.STRING,
			},
			pointInTimeRecovery: true,
			removalPolicy:
				this.node.tryGetContext('isTest') === true
					? RemovalPolicy.DESTROY
					: RemovalPolicy.RETAIN,
			timeToLiveAttribute: 'ttl',
		})

		const parseSinkMessages = new Lambda.Function(this, 'lambda', {
			handler: lambdaSources.parseSinkMessages.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.minutes(15),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(
				lambdaSources.parseSinkMessages.lambdaZipFile,
			),
			description: 'Parse sink messages',
			environment: {
				VERSION: this.node.tryGetContext('version'),
				TABLE_NAME: table.tableName,
			},
			initialPolicy: [],
			logRetention: Logs.RetentionDays.ONE_WEEK,
			// Only have one lambda at any given time processing messages
			reservedConcurrentExecutions: 1,
		})

		table.grantFullAccess(parseSinkMessages)

		const rule = new Iot.CfnTopicRule(this, 'sinkRule', {
			topicRulePayload: {
				sql: [
					`SELECT`,
					// Lambda rule actions don't support binary payload input
					`encode(*, 'base64') AS message,`,
					`parse_time("yyyy-MM-dd'T'HH:mm:ss.S'Z'",`,
					`timestamp()) as timestamp`,
					`FROM '+/nrplus-sink'`,
				].join(' '),
				awsIotSqlVersion: '2016-03-23',
				actions: [
					{
						lambda: {
							functionArn: parseSinkMessages.functionArn,
						},
					},
				],
				errorAction: {
					republish: {
						roleArn: topicRuleRole.roleArn,
						topic: 'errors',
					},
				},
			},
		})

		parseSinkMessages.addPermission('storeUpdatesRule', {
			principal: new IAM.ServicePrincipal('iot.amazonaws.com'),
			sourceArn: rule.attrArn,
		})
	}
}
