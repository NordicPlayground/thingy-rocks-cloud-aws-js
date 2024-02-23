import {
	Duration,
	aws_iam as IAM,
	aws_lambda as Lambda,
	RemovalPolicy,
	aws_s3 as S3,
	aws_events_targets as EventTargets,
	aws_events as Events,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { PackedLambda } from '../../backend.js'
import { LambdaLogGroup } from '../LambdaLogGroup.js'

/**
 * Publish a JSON of all LwM2M shadows so https://hello.nrfcloud.com/map can show them.
 */
export class PublicLwM2MShadows extends Construct {
	public readonly bucket: S3.Bucket
	constructor(
		parent: Construct,
		{
			baseLayer,
			lambdaSources,
		}: {
			baseLayer: Lambda.ILayerVersion
			lambdaSources: {
				publishLwM2MShadowsToJSON: PackedLambda
			}
		},
	) {
		super(parent, 'PublicLwM2MShadows')

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
					allowedOrigins: ['https://hello.nrfcloud.com', 'http://localhost:*'],
					allowedMethods: [S3.HttpMethods.GET],
				},
			],
		})

		const fn = new Lambda.Function(this, 'fn', {
			handler: lambdaSources.publishLwM2MShadowsToJSON.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_20_X,
			timeout: Duration.minutes(1),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(
				lambdaSources.publishLwM2MShadowsToJSON.lambdaZipFile,
			),
			description:
				'Provides the LwM2M shadow of the devices to https://hello.nrfcloud.com/map',
			layers: [baseLayer],
			environment: {
				VERSION: this.node.tryGetContext('version'),
				NODE_NO_WARNINGS: '1',
				BUCKET: this.bucket.bucketName,
			},
			...new LambdaLogGroup(this, 'devicesFnLogs'),
			initialPolicy: [
				new IAM.PolicyStatement({
					actions: ['iot:SearchIndex', 'iot:DescribeThing'],
					resources: ['*'],
				}),
			],
		})

		this.bucket.grantWrite(fn)

		const rule = new Events.Rule(this, 'rule', {
			description: `Rule to schedule publishLwM2MShadowsToJSON lambda invocations`,
			schedule: Events.Schedule.rate(Duration.minutes(1)),
		})
		rule.addTarget(new EventTargets.LambdaFunction(fn))
	}
}
