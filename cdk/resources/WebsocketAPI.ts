import {
	aws_apigatewayv2 as ApiGateway,
	aws_dynamodb as DynamoDB,
	aws_iam as IAM,
	aws_iot as IoT,
	aws_lambda as Lambda,
	Duration,
	RemovalPolicy,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { PackedLambda } from '../backend.js'
import { LambdaLogGroup } from '../resources/LambdaLogGroup.js'

export class WebsocketAPI extends Construct {
	public readonly websocketURI: string
	public readonly connectionsTable: DynamoDB.ITable
	public readonly websocketAPIArn: string
	public readonly websocketManagementAPIURL: string
	public constructor(
		parent: Stack,
		{
			lambdaSources,
			baseLayer,
		}: {
			lambdaSources: {
				publishToWebsocketClients: PackedLambda
				onConnect: PackedLambda
				onMessage: PackedLambda
				onDisconnect: PackedLambda
			}
			baseLayer: Lambda.ILayerVersion
		},
	) {
		super(parent, 'WebsocketAPI')

		this.connectionsTable = new DynamoDB.Table(this, 'connectionsTable', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'connectionId',
				type: DynamoDB.AttributeType.STRING,
			},
			timeToLiveAttribute: 'ttl',
			removalPolicy: RemovalPolicy.DESTROY,
		}) as DynamoDB.ITable

		// API
		const api = new ApiGateway.CfnApi(this, 'api', {
			name: 'deviceUpdates',
			protocolType: 'WEBSOCKET',
			routeSelectionExpression: '$request.body.message',
		})

		// Deploy
		const deployment = new ApiGateway.CfnDeployment(this, 'apiDeployment', {
			apiId: api.ref,
		})

		const stage = new ApiGateway.CfnStage(this, 'prodStage', {
			stageName: '2022-11-22',
			description: 'production stage',
			deploymentId: deployment.ref,
			apiId: api.ref,
		})

		this.websocketURI = `wss://${api.ref}.execute-api.${parent.region}.amazonaws.com/${stage.ref}`
		this.websocketAPIArn = `arn:aws:execute-api:${parent.region}:${parent.account}:${api.ref}/${stage.stageName}/POST/@connections/*`
		this.websocketManagementAPIURL = `https://${api.ref}.execute-api.${parent.region}.amazonaws.com/${stage.stageName}`

		// Connect
		const onConnect = new Lambda.Function(this, 'onConnect', {
			handler: lambdaSources.onConnect.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.seconds(5),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.onConnect.lambdaZipFile),
			description: 'Registers new clients',
			environment: {
				VERSION: this.node.tryGetContext('version'),
				CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName,
			},
			initialPolicy: [],
			layers: [baseLayer],
		})
		this.connectionsTable.grantWriteData(onConnect)

		new LambdaLogGroup(this, 'onConnectLogs', onConnect)
		const connectIntegration = new ApiGateway.CfnIntegration(
			this,
			'connectIntegration',
			{
				apiId: api.ref,
				description: 'Connect integration',
				integrationType: 'AWS_PROXY',
				integrationUri: `arn:aws:apigateway:${parent.region}:lambda:path/2015-03-31/functions/${onConnect.functionArn}/invocations`,
			},
		)
		const connectRoute = new ApiGateway.CfnRoute(this, 'connectRoute', {
			apiId: api.ref,
			routeKey: '$connect',
			authorizationType: 'NONE',
			operationName: 'ConnectRoute',
			target: `integrations/${connectIntegration.ref}`,
		})
		deployment.node.addDependency(connectRoute)

		// Send
		const onMessage = new Lambda.Function(this, 'onMessage', {
			handler: lambdaSources.onMessage.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.seconds(5),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.onMessage.lambdaZipFile),
			description: 'Receives messages from clients',
			environment: {
				VERSION: this.node.tryGetContext('version'),
				CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName,
				WEBSOCKET_MANAGEMENT_API_URL: this.websocketManagementAPIURL,
			},
			initialPolicy: [
				new IAM.PolicyStatement({
					actions: ['iot:DescribeThing'],
					resources: ['*'],
				}),
				new IAM.PolicyStatement({
					actions: ['iot:Publish'],
					resources: ['arn:aws:iot:*:*:topic/*/light-bulb/*'],
				}),
				new IAM.PolicyStatement({
					actions: ['execute-api:ManageConnections'],
					resources: [this.websocketAPIArn],
				}),
			],
			layers: [baseLayer],
		})
		this.connectionsTable.grantReadWriteData(onMessage)

		new LambdaLogGroup(this, 'onMessageLogs', onMessage)
		const sendMessageIntegration = new ApiGateway.CfnIntegration(
			this,
			'sendMessageIntegration',
			{
				apiId: api.ref,
				description: 'Send messages integration',
				integrationType: 'AWS_PROXY',
				integrationUri: `arn:aws:apigateway:${parent.region}:lambda:path/2015-03-31/functions/${onMessage.functionArn}/invocations`,
			},
		)
		const sendMessageRoute = new ApiGateway.CfnRoute(this, 'sendMessageRoute', {
			apiId: api.ref,
			routeKey: 'sendmessage',
			authorizationType: 'NONE',
			operationName: 'sendMessageRoute',
			target: `integrations/${sendMessageIntegration.ref}`,
		})
		deployment.node.addDependency(sendMessageRoute)

		// Disconnect
		const onDisconnect = new Lambda.Function(this, 'onDisconnect', {
			handler: lambdaSources.onDisconnect.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.seconds(5),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.onDisconnect.lambdaZipFile),
			description: 'De-registers disconnected clients',
			environment: {
				VERSION: this.node.tryGetContext('version'),
				CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName,
			},
			initialPolicy: [],
			layers: [baseLayer],
		})
		this.connectionsTable.grantWriteData(onDisconnect)

		new LambdaLogGroup(this, 'onDisconnectLogs', onDisconnect)
		const disconnectIntegration = new ApiGateway.CfnIntegration(
			this,
			'disconnectIntegration',
			{
				apiId: api.ref,
				description: 'Disconnect integration',
				integrationType: 'AWS_PROXY',
				integrationUri: `arn:aws:apigateway:${parent.region}:lambda:path/2015-03-31/functions/${onDisconnect.functionArn}/invocations`,
			},
		)
		const disconnectRoute = new ApiGateway.CfnRoute(this, 'disconnectRoute', {
			apiId: api.ref,
			routeKey: '$disconnect',
			authorizationType: 'NONE',
			operationName: 'DisconnectRoute',
			target: `integrations/${disconnectIntegration.ref}`,
		})
		deployment.node.addDependency(disconnectRoute)

		onMessage.addPermission('invokeByAPI', {
			principal: new IAM.ServicePrincipal(
				'apigateway.amazonaws.com',
			) as IAM.IPrincipal,
			sourceArn: `arn:aws:execute-api:${parent.region}:${parent.account}:${api.ref}/${stage.stageName}/sendmessage`,
		})
		onConnect.addPermission('invokeByAPI', {
			principal: new IAM.ServicePrincipal(
				'apigateway.amazonaws.com',
			) as IAM.IPrincipal,
			sourceArn: `arn:aws:execute-api:${parent.region}:${parent.account}:${api.ref}/${stage.stageName}/$connect`,
		})
		onDisconnect.addPermission('invokeByAPI', {
			principal: new IAM.ServicePrincipal(
				'apigateway.amazonaws.com',
			) as IAM.IPrincipal,
			sourceArn: `arn:aws:execute-api:${parent.region}:${parent.account}:${api.ref}/${stage.stageName}/$disconnect`,
		})

		// Publish events
		const publishToWebsocketClients = new Lambda.Function(
			this,
			'publishToWebsocketClients',
			{
				handler: lambdaSources.publishToWebsocketClients.handler,
				architecture: Lambda.Architecture.ARM_64,
				runtime: Lambda.Runtime.NODEJS_18_X,
				timeout: Duration.minutes(1),
				memorySize: 1792,
				code: Lambda.Code.fromAsset(
					lambdaSources.publishToWebsocketClients.lambdaZipFile,
				),
				description: 'Publishes device events to the websocket API.',
				environment: {
					VERSION: this.node.tryGetContext('version'),
					CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName,
					WEBSOCKET_MANAGEMENT_API_URL: this.websocketManagementAPIURL,
				},
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['execute-api:ManageConnections'],
						resources: [this.websocketAPIArn],
					}),
					new IAM.PolicyStatement({
						actions: ['iot:DescribeThing'],
						resources: ['*'],
					}),
				],
				layers: [baseLayer],
			},
		)

		this.connectionsTable.grantReadWriteData(publishToWebsocketClients)

		new LambdaLogGroup(
			this,
			'publishToWebsocketClientsLogs',
			publishToWebsocketClients,
		)

		const publishToWebsocketClientsRuleRole = new IAM.Role(
			this,
			'publishToWebsocketClientsRuleRole',
			{
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
			},
		)

		const publishShadowUpdatesRule = new IoT.CfnTopicRule(
			this,
			'publishShadowUpdatesRule',
			{
				topicRulePayload: {
					description: `Publish shadow updates to the Websocket API`,
					ruleDisabled: false,
					awsIotSqlVersion: '2016-03-23',
					sql: `SELECT current.state.reported AS reported, topic(3) as deviceId FROM '$aws/things/+/shadow/update/documents'`,
					actions: [
						{
							lambda: {
								functionArn: publishToWebsocketClients.functionArn,
							},
						},
					],
					errorAction: {
						republish: {
							roleArn: publishToWebsocketClientsRuleRole.roleArn,
							topic: 'errors',
						},
					},
				},
			},
		)

		publishToWebsocketClients.addPermission(
			'invokeByPublishShadowUpdatesRulePermission',
			{
				principal: new IAM.ServicePrincipal(
					'iot.amazonaws.com',
				) as IAM.IPrincipal,
				sourceArn: publishShadowUpdatesRule.attrArn,
			},
		)

		const publishMessagesRule = new IoT.CfnTopicRule(
			this,
			'publishMessagesRule',
			{
				topicRulePayload: {
					description: `Publish device messages to the Websocket API`,
					ruleDisabled: false,
					awsIotSqlVersion: '2016-03-23',
					sql: `SELECT * AS message, topic(1) as deviceId FROM '+/messages'`,
					actions: [
						{
							lambda: {
								functionArn: publishToWebsocketClients.functionArn,
							},
						},
					],
					errorAction: {
						republish: {
							roleArn: publishToWebsocketClientsRuleRole.roleArn,
							topic: 'errors',
						},
					},
				},
			},
		)

		publishToWebsocketClients.addPermission(
			'invokeByPublishMessagesRulePermission',
			{
				principal: new IAM.ServicePrincipal(
					'iot.amazonaws.com',
				) as IAM.IPrincipal,
				sourceArn: publishMessagesRule.attrArn,
			},
		)
	}
}
