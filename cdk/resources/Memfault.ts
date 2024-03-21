import {
	Duration,
	aws_events as Events,
	aws_events_targets as EventsTargets,
	aws_s3 as S3,
	aws_iam as IAM,
	aws_lambda as Lambda,
	aws_iot as IoT,
	Stack,
	RemovalPolicy,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { PackedLambda } from '../backend.js'
import { LambdaLogGroup } from './LambdaLogGroup.js'
import type { WebsocketAPI } from './WebsocketAPI.js'

/**
 * Pull Memfault data for devices
 */
export class Memfault extends Construct {
	public readonly bucket: S3.Bucket
	public constructor(
		parent: Construct,
		{
			lambdaSources,
			baseLayer,
			assetTrackerStackName,
			websocketAPI,
		}: {
			lambdaSources: {
				memfault: PackedLambda
				memfaultPollForReboots: PackedLambda
			}
			baseLayer: Lambda.ILayerVersion
			assetTrackerStackName: string
			websocketAPI: WebsocketAPI
		},
	) {
		super(parent, 'Memfault')

		this.bucket = new S3.Bucket(this, 'bucket', {
			autoDeleteObjects: true,
			removalPolicy: RemovalPolicy.DESTROY,
			publicReadAccess: true,
			websiteIndexDocument: 'index.html',
			blockPublicAccess: {
				blockPublicAcls: false,
				ignorePublicAcls: false,
				restrictPublicBuckets: false,
				blockPublicPolicy: false,
			},
			objectOwnership: S3.ObjectOwnership.OBJECT_WRITER,
			cors: [
				{
					allowedOrigins: ['https://world.thingy.rocks', 'http://localhost:*'],
					allowedMethods: [S3.HttpMethods.GET],
				},
			],
		})

		const fn = new Lambda.Function(this, 'fn', {
			handler: lambdaSources.memfault.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_20_X,
			timeout: Duration.seconds(60),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.memfault.lambdaZipFile),
			description: 'Pull Memfault data for devices and publish it on S3',
			layers: [baseLayer],
			environment: {
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: Stack.of(this).stackName,
				ASSET_TRACKER_STACK_NAME: assetTrackerStackName,
				NODE_NO_WARNINGS: '1',
				BUCKET: this.bucket.bucketName,
				CONNECTIONS_TABLE_NAME: websocketAPI.connectionsTable.tableName,
			},
			initialPolicy: [
				new IAM.PolicyStatement({
					actions: ['ssm:GetParametersByPath'],
					resources: [
						`arn:aws:ssm:${Stack.of(this).region}:${Stack.of(this).account}:parameter/${Stack.of(this).stackName}/memfault/*`,
					],
				}),
				new IAM.PolicyStatement({
					actions: ['iot:ListThingsInThingGroup'],
					resources: ['*'],
				}),
			],
			...new LambdaLogGroup(this, 'fnLogs'),
		})

		this.bucket.grantWrite(fn)
		websocketAPI.connectionsTable.grantReadData(fn)

		const rule = new Events.Rule(this, 'Rule', {
			schedule: Events.Schedule.expression('rate(5 minutes)'),
			description: `Invoke the Memfault lambda`,
			enabled: true,
			targets: [new EventsTargets.LambdaFunction(fn)],
		})

		fn.addPermission('InvokeByEvents', {
			principal: new IAM.ServicePrincipal(
				'events.amazonaws.com',
			) as IAM.IPrincipal,
			sourceArn: rule.ruleArn,
		})

		// When a devices publishes button press 42, poll the Memfault API for an update
		const pollForRebootsFn = new Lambda.Function(this, 'pollForRebootsFn', {
			handler: lambdaSources.memfaultPollForReboots.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_20_X,
			timeout: Duration.seconds(120),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(
				lambdaSources.memfaultPollForReboots.lambdaZipFile,
			),
			description:
				'Poll the Memfault API for an update after a device publishes a button event for button 42',
			layers: [baseLayer],
			environment: {
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: Stack.of(this).stackName,
				ASSET_TRACKER_STACK_NAME: assetTrackerStackName,
				NODE_NO_WARNINGS: '1',
				BUCKET: this.bucket.bucketName,
				CONNECTIONS_TABLE_NAME: websocketAPI.connectionsTable.tableName,
				WEBSOCKET_MANAGEMENT_API_URL: websocketAPI.websocketManagementAPIURL,
			},
			initialPolicy: [
				new IAM.PolicyStatement({
					actions: ['ssm:GetParametersByPath'],
					resources: [
						`arn:aws:ssm:${Stack.of(this).region}:${Stack.of(this).account}:parameter/${Stack.of(this).stackName}/memfault/*`,
					],
				}),
				new IAM.PolicyStatement({
					actions: ['execute-api:ManageConnections'],
					resources: [websocketAPI.websocketAPIArn],
				}),
				new IAM.PolicyStatement({
					actions: ['iot:DescribeThing'],
					resources: ['*'],
				}),
			],
			...new LambdaLogGroup(this, 'pollForRebootsFnLogs'),
		})

		websocketAPI.connectionsTable.grantFullAccess(pollForRebootsFn)

		const button42RuleRole = new IAM.Role(this, 'button42RuleRole', {
			assumedBy: new IAM.ServicePrincipal('iot.amazonaws.com'),
			inlinePolicies: {
				rootPermissions: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							actions: ['iot:Publish'],
							resources: [
								`arn:aws:iot:${Stack.of(this).region}:${Stack.of(this).account}:topic/errors`,
							],
						}),
					],
				}),
			},
		})

		const button42Rule = new IoT.CfnTopicRule(this, 'button42Rule', {
			topicRulePayload: {
				awsIotSqlVersion: '2016-03-23',
				description:
					'Trigger a fetch of the Memfault data when a device publishes a button event for button 42',
				ruleDisabled: false,
				sql: [
					'SELECT topic(1) as deviceId,',
					'btn.ts as ts,',
					`parse_time("yyyy-MM-dd'T'HH:mm:ss.S'Z'", timestamp()) as timestamp`,
					"FROM '+/messages'",
					'WHERE btn.v = 42',
				].join(' '),
				actions: [
					{
						lambda: {
							functionArn: pollForRebootsFn.functionArn,
						},
					},
				],
				errorAction: {
					republish: {
						roleArn: button42RuleRole.roleArn,
						topic: 'errors',
					},
				},
			},
		})

		pollForRebootsFn.addPermission('storeMessagesRule', {
			principal: new IAM.ServicePrincipal('iot.amazonaws.com'),
			sourceArn: button42Rule.attrArn,
		})
	}
}
