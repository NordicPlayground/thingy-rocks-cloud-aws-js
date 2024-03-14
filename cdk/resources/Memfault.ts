import {
	Duration,
	aws_events as Events,
	aws_events_targets as EventsTargets,
	aws_s3 as S3,
	aws_iam as IAM,
	aws_lambda as Lambda,
	Stack,
	RemovalPolicy,
} from 'aws-cdk-lib'
import type { IPrincipal } from 'aws-cdk-lib/aws-iam/index.js'
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
				WEBSOCKET_CONNECTIONS_TABLE_NAME:
					websocketAPI.connectionsTable.tableName,
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
			principal: new IAM.ServicePrincipal('events.amazonaws.com') as IPrincipal,
			sourceArn: rule.ruleArn,
		})
	}
}
