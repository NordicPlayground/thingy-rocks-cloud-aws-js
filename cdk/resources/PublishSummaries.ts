import {
	LambdaLogGroup,
	LambdaSource,
} from '@bifravst/aws-cdk-lambda-helpers/cdk'
import {
	Duration,
	aws_events as Events,
	aws_events_targets as EventsTargets,
	aws_iam as IAM,
	aws_lambda as Lambda,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../BackendLambdas.ts'
import type { LwM2MObjectsHistory } from './LwM2MObjectsHistory.ts'
import type { WebsocketAPI } from './WebsocketAPI.ts'

/**
 * Publish the summary statistics for the devices
 */
export class PublishSummaries extends Construct {
	public constructor(
		parent: Construct,
		{
			lambdaSources,
			baseLayer,
			websocketAPI,
			historicaldataTableInfo,
			historicaldataTableArn,
			lwM2MHistory,
		}: {
			lambdaSources: Pick<BackendLambdas, 'publishSummaries'>
			baseLayer: Lambda.ILayerVersion
			websocketAPI: WebsocketAPI
			historicaldataTableInfo: string
			historicaldataTableArn: string
			lwM2MHistory: LwM2MObjectsHistory
		},
	) {
		super(parent, 'PublishSummaries')

		const lambda = new Lambda.Function(this, 'lambda', {
			handler: lambdaSources.publishSummaries.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_22_X,
			timeout: Duration.seconds(60),
			memorySize: 1792,
			code: new LambdaSource(this, lambdaSources.publishSummaries).code,
			description:
				'Publish the summary statistics for the devices, invoked every minute',
			layers: [baseLayer],
			environment: {
				VERSION: this.node.tryGetContext('version'),
				CONNECTIONS_TABLE_NAME: websocketAPI.connectionsTable.tableName,
				WEBSOCKET_MANAGEMENT_API_URL: websocketAPI.websocketManagementAPIURL,
				HISTORICALDATA_TABLE_INFO: historicaldataTableInfo,
				LWM2M_OBJECT_HISTORY_TABLE_INFO: lwM2MHistory.table.ref,
			},
			initialPolicy: [
				new IAM.PolicyStatement({
					actions: ['execute-api:ManageConnections'],
					resources: [websocketAPI.websocketAPIArn],
				}),
				new IAM.PolicyStatement({
					resources: [historicaldataTableArn, lwM2MHistory.table.attrArn],
					actions: [
						'timestream:Select',
						'timestream:DescribeTable',
						'timestream:ListMeasures',
					],
				}),
				new IAM.PolicyStatement({
					resources: ['*'],
					actions: [
						'timestream:DescribeEndpoints',
						'timestream:SelectValues',
						'timestream:CancelQuery',
					],
				}),
				new IAM.PolicyStatement({
					actions: ['iot:DescribeThing', 'iot:ListThingsInThingGroup'],
					resources: ['*'],
				}),
			],
			...new LambdaLogGroup(this, 'lambdaLogs'),
		})

		websocketAPI.connectionsTable.grantFullAccess(lambda)

		const rule = new Events.Rule(this, 'Rule', {
			schedule: Events.Schedule.expression('rate(1 minute)'),
			description: `Invoke the summary lambda`,
			enabled: true,
			targets: [new EventsTargets.LambdaFunction(lambda)],
		})

		lambda.addPermission('InvokeByEvents', {
			principal: new IAM.ServicePrincipal(
				'events.amazonaws.com',
			) as IAM.IPrincipal,
			sourceArn: rule.ruleArn,
		})
	}
}
