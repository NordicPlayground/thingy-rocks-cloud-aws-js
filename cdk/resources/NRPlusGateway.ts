import { Duration, Stack } from 'aws-cdk-lib'
import IAM from 'aws-cdk-lib/aws-iam'
import Iot from 'aws-cdk-lib/aws-iot'
import Kinesis, { StreamMode } from 'aws-cdk-lib/aws-kinesis'
import Lambda, { StartingPosition } from 'aws-cdk-lib/aws-lambda'
import { KinesisEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import Logs from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'
import type { PackedLambda } from '../backend'

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

		const stream = new Kinesis.Stream(this, 'kinesis-stream', {
			shardCount: 1,
			// streamMode must be set to PROVISIONED  when specifying shardCount
			streamMode: StreamMode.PROVISIONED,
			// Minimum 1 day
			retentionPeriod: Duration.days(1),
		})

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
		stream.grantWrite(topicRuleRole)

		new Iot.CfnTopicRule(this, 'sinkRule', {
			topicRulePayload: {
				sql: `SELECT * FROM '+/nrplus-sink'`,
				awsIotSqlVersion: '2016-03-23',
				actions: [
					{
						kinesis: {
							streamName: stream.streamName,
							partitionKey: '${topic()}',
							roleArn: topicRuleRole.roleArn,
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
			},
			initialPolicy: [],
			logRetention: Logs.RetentionDays.ONE_WEEK,
			reservedConcurrentExecutions: 1,
		})

		parseSinkMessages.addEventSource(
			new KinesisEventSource(stream, {
				startingPosition: StartingPosition.TRIM_HORIZON,
				batchSize: 100,
				maxBatchingWindow: Duration.seconds(1),
				parallelizationFactor: 1,
			}),
		)
	}
}
