import {
	App,
	aws_iam as IAM,
	aws_iot as IoT,
	aws_lambda as Lambda,
	aws_dynamodb as DynamoDB,
	Duration,
	Stack,
	RemovalPolicy,
} from 'aws-cdk-lib'
import type { IPrincipal } from 'aws-cdk-lib/aws-iam/index.js'
import type { PackedLambda } from '../packLambda.js'
import type { PackedLayer } from '../packLayer.js'
import { LambdaLogGroup } from '../resources/LambdaLogGroup.js'
import { STACK_NAME } from './stackName.js'

export class BackendStack extends Stack {
	public constructor(
		parent: App,
		{
			lambdaSources,
			layer,
		}: {
			lambdaSources: {
				publishThingEvents: PackedLambda
				onConnect: PackedLambda
				onDisconnect: PackedLambda
			}
			layer: PackedLayer
		},
	) {
		super(parent, STACK_NAME)

		const connectionsTable = new DynamoDB.Table(this, 'connectionsTable', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'connectionId',
				type: DynamoDB.AttributeType.STRING,
			},
			timeToLiveAttribute: 'ttl',
			removalPolicy: RemovalPolicy.DESTROY,
		})

		const baseLayer = new Lambda.LayerVersion(this, 'baseLayer', {
			code: Lambda.Code.fromAsset(layer.layerZipFile),
			compatibleArchitectures: [Lambda.Architecture.ARM_64],
			compatibleRuntimes: [Lambda.Runtime.NODEJS_18_X],
		})

		// Publish events

		const publishThingEvents = new Lambda.Function(this, 'publishThingEvents', {
			handler: lambdaSources.publishThingEvents.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.minutes(1),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(
				lambdaSources.publishThingEvents.lambdaZipFile,
			),
			description: 'Publishes AWS IoT thing events to the websocket API.',
			environment: {
				VERSION: this.node.tryGetContext('version'),
				CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
			},
			initialPolicy: [],
			layers: [baseLayer],
		})

		new LambdaLogGroup(this, 'publishThingEventsLogs', publishThingEvents)

		const publishThingEventsRuleRole = new IAM.Role(
			this,
			'publishThingEventsRuleRole',
			{
				assumedBy: new IAM.ServicePrincipal('iot.amazonaws.com') as IPrincipal,
				inlinePolicies: {
					rootPermissions: new IAM.PolicyDocument({
						statements: [
							new IAM.PolicyStatement({
								actions: ['iot:DescribeThing'],
								resources: [`*`],
							}),
							new IAM.PolicyStatement({
								actions: ['iot:Publish'],
								resources: [
									`arn:aws:iot:${parent.region}:${parent.account}:topic/errors`,
								],
							}),
						],
					}),
				},
			},
		)

		const publishThingEventsRule = new IoT.CfnTopicRule(
			this,
			'publishThingEventsRule',
			{
				topicRulePayload: {
					description: `Invokes the lambda function which publishes the thing events`,
					ruleDisabled: false,
					awsIotSqlVersion: '2016-03-23',
					sql: "SELECT state.reported AS reported, clientid() as deviceId FROM '$aws/things/+/shadow/update'",
					actions: [
						{
							lambda: {
								functionArn: publishThingEvents.functionArn,
							},
						},
					],
					errorAction: {
						republish: {
							roleArn: publishThingEventsRuleRole.roleArn,
							topic: 'errors',
						},
					},
				},
			},
		)

		publishThingEvents.addPermission(
			'publishThingEventsInvokeByIotPermission',
			{
				principal: new IAM.ServicePrincipal('iot.amazonaws.com') as IPrincipal,
				sourceArn: publishThingEventsRule.attrArn,
			},
		)

		connectionsTable.grantReadData(publishThingEvents)

		// OnConnect

		const onConnect = new Lambda.Function(this, 'onConnect', {
			handler: lambdaSources.onConnect.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.seconds(1),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.onConnect.lambdaZipFile),
			description: 'Registers new clients',
			environment: {
				VERSION: this.node.tryGetContext('version'),
				CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
			},
			initialPolicy: [],
			layers: [baseLayer],
		})
		connectionsTable.grantWriteData(onConnect)

		new LambdaLogGroup(this, 'onConnectLogs', onConnect)

		// OnDisconnect

		const onDisconnect = new Lambda.Function(this, 'onDisconnect', {
			handler: lambdaSources.onConnect.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.seconds(1),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.onDisconnect.lambdaZipFile),
			description: 'Registers new clients',
			environment: {
				VERSION: this.node.tryGetContext('version'),
				CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
			},
			initialPolicy: [],
			layers: [baseLayer],
		})
		connectionsTable.grantWriteData(onDisconnect)

		new LambdaLogGroup(this, 'onDisconnectLogs', onDisconnect)
	}
}
