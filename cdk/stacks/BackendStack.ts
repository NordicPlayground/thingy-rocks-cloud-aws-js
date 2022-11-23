import {
	App,
	aws_apigatewayv2 as ApiGateway,
	aws_dynamodb as DynamoDB,
	aws_iam as IAM,
	aws_iot as IoT,
	aws_lambda as Lambda,
	CfnOutput,
	Duration,
	RemovalPolicy,
	Stack,
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
				onMessage: PackedLambda
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

		// onMessage

		const onMessage = new Lambda.Function(this, 'onMessage', {
			handler: lambdaSources.onMessage.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.seconds(1),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.onMessage.lambdaZipFile),
			description: 'Receives messages from clients',
			environment: {
				VERSION: this.node.tryGetContext('version'),
				CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
			},
			initialPolicy: [],
			layers: [baseLayer],
		})
		connectionsTable.grantWriteData(onMessage)

		new LambdaLogGroup(this, 'onMessageLogs', onMessage)

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

		// API

		const api = new ApiGateway.CfnApi(this, 'api', {
			name: 'deviceUpdates',
			protocolType: 'WEBSOCKET',
			routeSelectionExpression: '$request.body.message',
		})

		// Connect
		const connectIntegration = new ApiGateway.CfnIntegration(
			this,
			'connectIntegration',
			{
				apiId: api.ref,
				description: 'Connect integration',
				integrationType: 'AWS_PROXY',
				integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${onConnect.functionArn}/invocations`,
			},
		)
		const connectRoute = new ApiGateway.CfnRoute(this, 'connectRoute', {
			apiId: api.ref,
			routeKey: '$connect',
			authorizationType: 'NONE',
			operationName: 'ConnectRoute',
			target: `integrations/${connectIntegration.ref}`,
		})

		// Send
		const sendMessageIntegration = new ApiGateway.CfnIntegration(
			this,
			'sendMessageIntegration',
			{
				apiId: api.ref,
				description: 'Send messages integration',
				integrationType: 'AWS_PROXY',
				integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${onMessage.functionArn}/invocations`,
			},
		)
		const sendMessageRoute = new ApiGateway.CfnRoute(this, 'sendMessageRoute', {
			apiId: api.ref,
			routeKey: 'sendmessage',
			authorizationType: 'NONE',
			operationName: 'sendMessageRoute',
			target: `integrations/${sendMessageIntegration.ref}`,
		})

		// Disconnect
		const disconnectIntegration = new ApiGateway.CfnIntegration(
			this,
			'disconnectIntegration',
			{
				apiId: api.ref,
				description: 'Disconnect integration',
				integrationType: 'AWS_PROXY',
				integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${onDisconnect.functionArn}/invocations`,
			},
		)
		const disconnectRoute = new ApiGateway.CfnRoute(this, 'disconnectRoute', {
			apiId: api.ref,
			routeKey: '$disconnect',
			authorizationType: 'NONE',
			operationName: 'DisconnectRoute',
			target: `integrations/${disconnectIntegration.ref}`,
		})

		// Deploy
		const deployment = new ApiGateway.CfnDeployment(this, 'apiDeployment', {
			apiId: api.ref,
		})
		deployment.node.addDependency(connectRoute)
		deployment.node.addDependency(sendMessageRoute)
		deployment.node.addDependency(disconnectRoute)

		const stage = new ApiGateway.CfnStage(this, 'prodStage', {
			stageName: '2022-11-22',
			description: 'production stage',
			deploymentId: deployment.ref,
			apiId: api.ref,
		})

		onMessage.addPermission('invokeByAPI', {
			principal: new IAM.ServicePrincipal(
				'apigateway.amazonaws.com',
			) as IPrincipal,
			sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${api.ref}/${stage.stageName}/sendmessage`,
		})
		onConnect.addPermission('invokeByAPI', {
			principal: new IAM.ServicePrincipal(
				'apigateway.amazonaws.com',
			) as IPrincipal,
			sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${api.ref}/${stage.stageName}/$connect`,
		})
		onDisconnect.addPermission('invokeByAPI', {
			principal: new IAM.ServicePrincipal(
				'apigateway.amazonaws.com',
			) as IPrincipal,
			sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${api.ref}/${stage.stageName}/$disconnect`,
		})

		// Outputs
		new CfnOutput(this, 'WebSocketURIOutput', {
			exportName: 'WebSocketURI',
			description: 'The WSS Protocol URI to connect to',
			value: `wss://${api.ref}.execute-api.${this.region}.amazonaws.com/${stage.ref}`,
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
				API_ENDPOINT: `https://${api.ref}.execute-api.${this.region}.amazonaws.com/${stage.stageName}`,
			},
			initialPolicy: [
				new IAM.PolicyStatement({
					actions: ['execute-api:ManageConnections'],
					resources: [
						`arn:aws:execute-api:${this.region}:${this.account}:${api.ref}/${stage.stageName}/POST/@connections/*`,
					],
				}),
			],
			layers: [baseLayer],
		})

		new LambdaLogGroup(this, 'publishThingEventsLogs', publishThingEvents)

		connectionsTable.grantWriteData(publishThingEvents)

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
					sql: "SELECT current.state.reported AS reported, topic(3) as deviceId FROM '$aws/things/+/shadow/name/+/update/documents'",
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
	}
}

export type StackOutputs = {
	WebSocketURI: string
}
