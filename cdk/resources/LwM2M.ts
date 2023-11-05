import { Construct } from 'constructs'
import {
	aws_dynamodb as DynamoDB,
	RemovalPolicy,
	Duration,
	aws_iam as IAM,
	aws_iot as IoT,
	aws_lambda as Lambda,
	Stack,
	aws_logs as Logs,
} from 'aws-cdk-lib'
import type { PackedLambda } from '../backend'

/**
 * Contains resources that provide LwM2M based data for devices
 */
export class LwM2M extends Construct {
	public readonly table: DynamoDB.ITable
	constructor(
		parent: Construct,
		{
			lambdaSources,
			baseLayer,
		}: {
			lambdaSources: {
				updatesToLwM2M: PackedLambda
			}
			baseLayer: Lambda.ILayerVersion
		},
	) {
		super(parent, 'LwM2M')

		this.table = new DynamoDB.Table(this, 'table', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'id',
				type: DynamoDB.AttributeType.STRING,
			},
			timeToLiveAttribute: 'ttl',
			removalPolicy: RemovalPolicy.DESTROY,
		})

		const fn = new Lambda.Function(this, 'updatesToLwM2M', {
			handler: lambdaSources.updatesToLwM2M.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.seconds(60),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.updatesToLwM2M.lambdaZipFile),
			description:
				'Invoked when devices report their cell locationStore shadow updates asset_tracker_v2 shadow format as LwM2M objects in a named shadow. Also store the updates in a table for historical data.',
			layers: [baseLayer],
			environment: {
				VERSION: this.node.tryGetContext('version'),
				TABLE_NAME: this.table.tableName,
			},
			initialPolicy: [
				new IAM.PolicyStatement({
					actions: ['iot:UpdateThingShadow'],
					resources: ['*'],
				}),
			],
			logRetention: Logs.RetentionDays.ONE_WEEK,
		})

		this.table.grantWriteData(fn)

		const ruleRole = new IAM.Role(this, 'ruleRole', {
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
		})

		const rule = new IoT.CfnTopicRule(this, 'rule', {
			topicRulePayload: {
				description: `Convert shadow updates to LwM2M`,
				ruleDisabled: false,
				awsIotSqlVersion: '2016-03-23',
				sql: [
					`SELECT * as update,`,
					`topic(3) as deviceId`,
					`FROM '$aws/things/+/shadow/update'`,
				].join(' '),
				actions: [
					{
						lambda: {
							functionArn: fn.functionArn,
						},
					},
				],
				errorAction: {
					republish: {
						roleArn: ruleRole.roleArn,
						topic: 'errors',
					},
				},
			},
		})

		fn.addPermission('invokeByRule', {
			principal: new IAM.ServicePrincipal(
				'iot.amazonaws.com',
			) as IAM.IPrincipal,
			sourceArn: rule.attrArn,
		})
	}
}