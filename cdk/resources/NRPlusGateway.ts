import {
	LambdaLogGroup,
	PackedLambdaFn,
} from '@bifravst/aws-cdk-lambda-helpers/cdk'
import { Duration, Stack } from 'aws-cdk-lib'
import IAM from 'aws-cdk-lib/aws-iam'
import Iot from 'aws-cdk-lib/aws-iot'
import Kinesis, { StreamMode } from 'aws-cdk-lib/aws-kinesis'
import type Lambda from 'aws-cdk-lib/aws-lambda'
import { StartingPosition } from 'aws-cdk-lib/aws-lambda'
import { KinesisEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../BackendLambdas.ts'

export class NRPlusGateway extends Construct {
	public readonly parseSinkMessagesFn: PackedLambdaFn

	constructor(
		parent: Construct,
		{
			lambdaSources,
			layer,
		}: {
			lambdaSources: Pick<BackendLambdas, 'parseSinkMessages'>
			layer: Lambda.ILayerVersion
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

		this.parseSinkMessagesFn = new PackedLambdaFn(
			this,
			'parseSinkMessagesFn',
			lambdaSources.parseSinkMessages,
			{
				timeout: Duration.minutes(15),
				memorySize: 1792,
				description: 'Parse sink messages',
				environment: {
					VERSION: this.node.tryGetContext('version'),
				},
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['iot:UpdateThingShadow'],
						resources: ['*'],
					}),
				],
				...new LambdaLogGroup(this, 'parseSinkMessagesFnLogs'),
				reservedConcurrentExecutions: 1,
				layers: [layer],
			},
		)

		this.parseSinkMessagesFn.fn.addEventSource(
			new KinesisEventSource(stream, {
				startingPosition: StartingPosition.TRIM_HORIZON,
				batchSize: 100,
				maxBatchingWindow: Duration.seconds(1),
				parallelizationFactor: 1,
			}),
		)
	}
}
