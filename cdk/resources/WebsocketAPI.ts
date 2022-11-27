import {
	aws_apigatewayv2 as ApiGateway,
	aws_dynamodb as DynamoDB,
	aws_events as Events,
	aws_events_targets as EventTargets,
	aws_iam as IAM,
	aws_iot as IoT,
	aws_lambda as Lambda,
	Duration,
	RemovalPolicy,
	Stack,
} from 'aws-cdk-lib'
import type { IPrincipal } from 'aws-cdk-lib/aws-iam/index.js'
import { Construct } from 'constructs'
import type { PackedLambda } from '../packLambda.js'
import type { PackedLayer } from '../packLayer.js'
import { LambdaLogGroup } from '../resources/LambdaLogGroup.js'

export class WebsocketAPI extends Construct {
	public readonly websocketURI: string
	public constructor(
		parent: Stack,
		{
			lambdaSources,
			layer,
			assetTrackerStackName,
		}: {
			lambdaSources: {
				publishToWebsocketClients: PackedLambda
				onConnect: PackedLambda
				onMessage: PackedLambda
				onDisconnect: PackedLambda
				onCellGeoLocationResolved: PackedLambda
			}
			layer: PackedLayer
			assetTrackerStackName: string
		},
	) {
		super(parent, 'WebsocketAPI')

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

		// Send
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

		// Disconnect
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

		this.websocketURI = `wss://${api.ref}.execute-api.${parent.region}.amazonaws.com/${stage.ref}`

		onMessage.addPermission('invokeByAPI', {
			principal: new IAM.ServicePrincipal(
				'apigateway.amazonaws.com',
			) as IPrincipal,
			sourceArn: `arn:aws:execute-api:${parent.region}:${parent.account}:${api.ref}/${stage.stageName}/sendmessage`,
		})
		onConnect.addPermission('invokeByAPI', {
			principal: new IAM.ServicePrincipal(
				'apigateway.amazonaws.com',
			) as IPrincipal,
			sourceArn: `arn:aws:execute-api:${parent.region}:${parent.account}:${api.ref}/${stage.stageName}/$connect`,
		})
		onDisconnect.addPermission('invokeByAPI', {
			principal: new IAM.ServicePrincipal(
				'apigateway.amazonaws.com',
			) as IPrincipal,
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
					CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
					API_ENDPOINT: `https://${api.ref}.execute-api.${parent.region}.amazonaws.com/${stage.stageName}`,
				},
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['execute-api:ManageConnections'],
						resources: [
							`arn:aws:execute-api:${parent.region}:${parent.account}:${api.ref}/${stage.stageName}/POST/@connections/*`,
						],
					}),
				],
				layers: [baseLayer],
			},
		)

		connectionsTable.grantReadData(publishToWebsocketClients)

		new LambdaLogGroup(
			this,
			'publishToWebsocketClientsLogs',
			publishToWebsocketClients,
		)

		connectionsTable.grantWriteData(publishToWebsocketClients)

		const publishToWebsocketClientsRuleRole = new IAM.Role(
			this,
			'publishToWebsocketClientsRuleRole',
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

		const publishShadowUpdatesRule = new IoT.CfnTopicRule(
			this,
			'publishShadowUpdatesRule',
			{
				topicRulePayload: {
					description: `Publish shadow updates to the Websocket API`,
					ruleDisabled: false,
					awsIotSqlVersion: '2016-03-23',
					sql: `SELECT current.state.reported AS reported, topic(3) as deviceId, parse_time("yyyy-MM-dd'T'HH:mm:ss.S'Z'", timestamp()) as receivedTimestamp FROM '$aws/things/+/shadow/update/documents'`,
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
				principal: new IAM.ServicePrincipal('iot.amazonaws.com') as IPrincipal,
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
					sql: `SELECT * AS message, topic(1) as deviceId, parse_time("yyyy-MM-dd'T'HH:mm:ss.S'Z'", timestamp()) as receivedTimestamp FROM '+/messages'`,
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
				principal: new IAM.ServicePrincipal('iot.amazonaws.com') as IPrincipal,
				sourceArn: publishMessagesRule.attrArn,
			},
		)

		// Publish cell geo location resolution results

		const onCellGeoLocationResolved = new Lambda.Function(
			this,
			'onCellGeoLocationResolvedLambda',
			{
				handler: lambdaSources.onCellGeoLocationResolved.handler,
				architecture: Lambda.Architecture.ARM_64,
				runtime: Lambda.Runtime.NODEJS_18_X,
				timeout: Duration.seconds(1),
				memorySize: 1792,
				code: Lambda.Code.fromAsset(
					lambdaSources.onCellGeoLocationResolved.lambdaZipFile,
				),
				description: 'Publish cell geolocation resolutions',
				environment: {
					VERSION: this.node.tryGetContext('version'),
					CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
				},
				initialPolicy: [],
				layers: [baseLayer],
			},
		)
		connectionsTable.grantReadData(onCellGeoLocationResolved)

		new LambdaLogGroup(
			this,
			'onCellGeoLocationResolvedLogGroup',
			onCellGeoLocationResolved,
		)

		const publishCellGeolocationSuccessEventsRule = new Events.Rule(
			this,
			'publishCellGeolocationSuccessEventsRule',
			{
				description:
					'Invokes a lambda on success results from the Cell Geolocation StepFunction',
				eventPattern: {
					source: ['aws.states'],
					detailType: ['Step Functions Execution Status Change'],
					detail: {
						status: ['SUCCEEDED'],
						stateMachineArn: [
							`arn:aws:states:${parent.region}:${parent.account}:stateMachine:${assetTrackerStackName}-cellGeo`,
						],
					},
				},
				targets: [new EventTargets.LambdaFunction(onCellGeoLocationResolved)],
			},
		)

		onCellGeoLocationResolved.addPermission(
			'invokeByPublishCellGeolocationSuccessEventsRulePermission',
			{
				principal: new IAM.ServicePrincipal(
					'events.amazonaws.com',
				) as IPrincipal,
				sourceArn: publishCellGeolocationSuccessEventsRule.ruleArn,
			},
		)
	}
}
