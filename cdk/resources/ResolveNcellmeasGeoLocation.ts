import {
	aws_dynamodb as DynamoDB,
	aws_events as Events,
	aws_events_targets as EventTargets,
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
 * Notify clients about resolved neighboring cell location reports geo locations
 */
export class ResolveNcellmeasGeoLocation extends Construct {
	constructor(
		parent: Stack,
		{
			lambdaSources,
			baseLayer,
			websocketAPI,
			neighborCellGeolocationApiUrl,
			reportsTable,
			ncellmeasGeoStateMachineARN,
		}: {
			lambdaSources: {
				onNewNcellmeasReport: PackedLambda
				onNcellmeasReportResolved: PackedLambda
			}
			baseLayer: Lambda.ILayerVersion
			websocketAPI: WebsocketAPI
			neighborCellGeolocationApiUrl: string
			reportsTable: DynamoDB.ITable
			ncellmeasGeoStateMachineARN: string
		},
	) {
		super(parent, 'ResolveNcellmeasGeoLocation')

		// Invoke a Lambda function for every new neighboring cell report.
		// This lambda will check if there are clients connected to the WebSocket API
		// and init the geolocation resolution of the report.

		const onNewNcellmeasReport = new Lambda.Function(
			this,
			'onNewNcellmeasReport',
			{
				handler: lambdaSources.onNewNcellmeasReport.handler,
				architecture: Lambda.Architecture.ARM_64,
				runtime: Lambda.Runtime.NODEJS_18_X,
				timeout: Duration.seconds(60),
				memorySize: 1792,
				code: Lambda.Code.fromAsset(
					lambdaSources.onNewNcellmeasReport.lambdaZipFile,
				),
				description:
					'Invoked when devices publishes a new neighboring cell report',
				layers: [baseLayer],
				environment: {
					VERSION: this.node.tryGetContext('version'),
					CONNECTIONS_TABLE_NAME: websocketAPI.connectionsTable.tableName,
					WEBSOCKET_MANAGEMENT_API_URL: websocketAPI.websocketManagementAPIURL,
					NCELLMEAS_API_URL: neighborCellGeolocationApiUrl,
				},
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['execute-api:ManageConnections'],
						resources: [websocketAPI.websocketAPIArn],
					}),
				],
			},
		)

		new LambdaLogGroup(this, 'onNewNcellmeasReportLogs', onNewNcellmeasReport)

		websocketAPI.connectionsTable.grantFullAccess(onNewNcellmeasReport)

		onNewNcellmeasReport.addEventSource(
			new LambdaEvents.DynamoEventSource(reportsTable, {
				startingPosition: Lambda.StartingPosition.TRIM_HORIZON,
				batchSize: 1,
				retryAttempts: 2,
				maxRecordAge: Duration.minutes(10),
			}),
		)

		// Publish neighboring cell report geo location resolutions

		const onNcellmeasReportResolved = new Lambda.Function(
			this,
			'onNcellmeasReportResolvedLambda',
			{
				handler: lambdaSources.onNcellmeasReportResolved.handler,
				architecture: Lambda.Architecture.ARM_64,
				runtime: Lambda.Runtime.NODEJS_18_X,
				timeout: Duration.seconds(60),
				memorySize: 1792,
				code: Lambda.Code.fromAsset(
					lambdaSources.onNcellmeasReportResolved.lambdaZipFile,
				),
				description: 'Publish neighboring cell report geo location resolutions',
				environment: {
					VERSION: this.node.tryGetContext('version'),
					CONNECTIONS_TABLE_NAME: websocketAPI.connectionsTable.tableName,
					WEBSOCKET_MANAGEMENT_API_URL: websocketAPI.websocketManagementAPIURL,
				},
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['execute-api:ManageConnections'],
						resources: [websocketAPI.websocketAPIArn],
					}),
				],
				layers: [baseLayer],
			},
		)
		websocketAPI.connectionsTable.grantFullAccess(onNcellmeasReportResolved)

		new LambdaLogGroup(
			this,
			'onNcellmeasReportResolvedLogGroup',
			onNcellmeasReportResolved,
		)

		const publishNcellmeasReportGeolocationSuccessEventsRule = new Events.Rule(
			this,
			'publishNcellmeasReportGeolocationSuccessEventsRule',
			{
				description:
					'Invokes a lambda on success results from the Ncellmeas Geolocation StepFunction',
				eventPattern: {
					source: ['aws.states'],
					detailType: ['Step Functions Execution Status Change'],
					detail: {
						status: ['SUCCEEDED'],
						stateMachineArn: [ncellmeasGeoStateMachineARN],
					},
				},
				targets: [new EventTargets.LambdaFunction(onNcellmeasReportResolved)],
			},
		)

		onNcellmeasReportResolved.addPermission(
			'invokeByPublishNcellmeasReportGeolocationSuccessEventsRulePermission',
			{
				principal: new IAM.ServicePrincipal(
					'events.amazonaws.com',
				) as IAM.IPrincipal,
				sourceArn: publishNcellmeasReportGeolocationSuccessEventsRule.ruleArn,
			},
		)
	}
}
