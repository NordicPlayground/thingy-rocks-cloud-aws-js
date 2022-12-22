import {
	aws_dynamodb as DynamoDB,
	aws_iam as IAM,
	aws_lambda as Lambda,
	aws_lambda_event_sources as LambdaEvents,
	Duration,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { PackedLambda } from '../backend'
import { LambdaLogGroup } from './LambdaLogGroup'
import type { WebsocketAPI } from './WebsocketAPI'

/**
 * Notify clients about resolved WiFi site survey geo locations
 */
export class ResolveWiFiSiteSurveyGeoLocation extends Construct {
	constructor(
		parent: Stack,
		{
			lambdaSources,
			baseLayer,
			websocketAPI,
			wiFiSiteSurveyGeolocationApiUrl,
			surveysTable,
		}: {
			lambdaSources: {
				onNewWiFiSiteSurveyReport: PackedLambda
			}
			baseLayer: Lambda.ILayerVersion
			websocketAPI: WebsocketAPI
			wiFiSiteSurveyGeolocationApiUrl: string
			surveysTable: DynamoDB.ITable
		},
	) {
		super(parent, 'ResolveWiFiSiteSurveyGeoLocation')

		// Invoke a Lambda function for every new WiFi site survey or updated.
		// This lambda will check if there are clients connected to the WebSocket API
		// and init the geolocation resolution of the report or send the resolve
		// location.

		const onNewWiFiSiteSurveyReport = new Lambda.Function(
			this,
			'onNewWiFiSiteSurveyReport',
			{
				handler: lambdaSources.onNewWiFiSiteSurveyReport.handler,
				architecture: Lambda.Architecture.ARM_64,
				runtime: Lambda.Runtime.NODEJS_18_X,
				timeout: Duration.seconds(60),
				memorySize: 1792,
				code: Lambda.Code.fromAsset(
					lambdaSources.onNewWiFiSiteSurveyReport.lambdaZipFile,
				),
				description:
					'Invoked when devices publishes a new neighboring cell report',
				layers: [baseLayer],
				environment: {
					VERSION: this.node.tryGetContext('version'),
					CONNECTIONS_TABLE_NAME: websocketAPI.connectionsTable.tableName,
					WEBSOCKET_MANAGEMENT_API_URL: websocketAPI.websocketManagementAPIURL,
					WIFISITESURVEY_API_URL: wiFiSiteSurveyGeolocationApiUrl,
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
			},
		)

		new LambdaLogGroup(
			this,
			'onNewWiFiSiteSurveyReportLogs',
			onNewWiFiSiteSurveyReport,
		)

		websocketAPI.connectionsTable.grantFullAccess(onNewWiFiSiteSurveyReport)

		onNewWiFiSiteSurveyReport.addEventSource(
			new LambdaEvents.DynamoEventSource(surveysTable, {
				startingPosition: Lambda.StartingPosition.TRIM_HORIZON,
				batchSize: 1,
				retryAttempts: 2,
				maxRecordAge: Duration.minutes(10),
			}),
		)
	}
}
