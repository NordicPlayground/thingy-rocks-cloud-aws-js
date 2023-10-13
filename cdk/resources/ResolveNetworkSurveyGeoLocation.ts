import {
	Duration,
	aws_dynamodb as DynamoDB,
	aws_events_targets as EventTargets,
	aws_events as Events,
	aws_iam as IAM,
	aws_lambda as Lambda,
	aws_lambda_event_sources as LambdaEvents,
	Stack,
	aws_logs as Logs,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { PackedLambda } from '../backend'
import type { WebsocketAPI } from './WebsocketAPI'

/**
 * Notify clients about resolved neighboring cell location reports geo locations
 */
export class ResolveNetworkSurveyGeoLocation extends Construct {
	constructor(
		parent: Stack,
		{
			lambdaSources,
			baseLayer,
			websocketAPI,
			networkSurveyGeolocationApiUrl,
			surveysTable,
			networkSurveyGeoStateMachineARN,
		}: {
			lambdaSources: {
				onNewNetworkSurvey: PackedLambda
				onNetworkSurveyLocated: PackedLambda
			}
			baseLayer: Lambda.ILayerVersion
			websocketAPI: WebsocketAPI
			networkSurveyGeolocationApiUrl: string
			surveysTable: DynamoDB.ITable
			networkSurveyGeoStateMachineARN: string
		},
	) {
		super(parent, 'ResolveNetworkSurveyGeoLocation')

		// Invoke a Lambda function for every new network survey.
		// This lambda will check if there are clients connected to the WebSocket API
		// and init the geolocation resolution of the report.

		const onNewNetworkSurvey = new Lambda.Function(this, 'onNewNetworkSurvey', {
			handler: lambdaSources.onNewNetworkSurvey.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: Duration.seconds(60),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(
				lambdaSources.onNewNetworkSurvey.lambdaZipFile,
			),
			description: 'Invoked when devices publishes a new network survey',
			layers: [baseLayer],
			environment: {
				VERSION: this.node.tryGetContext('version'),
				CONNECTIONS_TABLE_NAME: websocketAPI.connectionsTable.tableName,
				WEBSOCKET_MANAGEMENT_API_URL: websocketAPI.websocketManagementAPIURL,
				NETWORK_SURVEY_GEOLOCATION_API_URL: networkSurveyGeolocationApiUrl,
			},
			initialPolicy: [
				new IAM.PolicyStatement({
					actions: ['execute-api:ManageConnections'],
					resources: [websocketAPI.websocketAPIArn],
				}),
				new IAM.PolicyStatement({
					actions: ['iot:DescribeThing'],
					resources: ['*'],
				}),
			],
			logRetention: Logs.RetentionDays.ONE_WEEK,
		})

		websocketAPI.connectionsTable.grantFullAccess(onNewNetworkSurvey)

		onNewNetworkSurvey.addEventSource(
			new LambdaEvents.DynamoEventSource(surveysTable, {
				startingPosition: Lambda.StartingPosition.TRIM_HORIZON,
				batchSize: 1,
				retryAttempts: 2,
				maxRecordAge: Duration.minutes(10),
			}),
		)

		// Publish network survey geo location resolutions

		const onNetworkSurveyLocated = new Lambda.Function(
			this,
			'onNetworkSurveyLocated',
			{
				handler: lambdaSources.onNetworkSurveyLocated.handler,
				architecture: Lambda.Architecture.ARM_64,
				runtime: Lambda.Runtime.NODEJS_18_X,
				timeout: Duration.seconds(60),
				memorySize: 1792,
				code: Lambda.Code.fromAsset(
					lambdaSources.onNetworkSurveyLocated.lambdaZipFile,
				),
				description: 'Publish network survey geo location resolutions',
				environment: {
					VERSION: this.node.tryGetContext('version'),
					CONNECTIONS_TABLE_NAME: websocketAPI.connectionsTable.tableName,
					WEBSOCKET_MANAGEMENT_API_URL: websocketAPI.websocketManagementAPIURL,
					NETWORK_SURVEY_TABLE_NAME: surveysTable.tableName,
				},
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['execute-api:ManageConnections'],
						resources: [websocketAPI.websocketAPIArn],
					}),
					new IAM.PolicyStatement({
						actions: ['iot:DescribeThing'],
						resources: ['*'],
					}),
				],
				layers: [baseLayer],
				logRetention: Logs.RetentionDays.ONE_WEEK,
			},
		)
		websocketAPI.connectionsTable.grantFullAccess(onNetworkSurveyLocated)
		surveysTable.grantReadData(onNetworkSurveyLocated)

		const publishNetworkSurveyGeolocationSuccessEventsRule = new Events.Rule(
			this,
			'publishNetworkSurveyGeolocationSuccessEventsRule',
			{
				description:
					'Invokes a lambda on success results from the Network Survey Geolocation StepFunction',
				eventPattern: {
					source: ['aws.states'],
					detailType: ['Step Functions Execution Status Change'],
					detail: {
						status: ['SUCCEEDED'],
						stateMachineArn: [networkSurveyGeoStateMachineARN],
					},
				},
				targets: [new EventTargets.LambdaFunction(onNetworkSurveyLocated)],
			},
		)

		onNetworkSurveyLocated.addPermission(
			'invokeBypublishNetworkSurveyGeolocationSuccessEventsRulePermission',
			{
				principal: new IAM.ServicePrincipal(
					'events.amazonaws.com',
				) as IAM.IPrincipal,
				sourceArn: publishNetworkSurveyGeolocationSuccessEventsRule.ruleArn,
			},
		)
	}
}
