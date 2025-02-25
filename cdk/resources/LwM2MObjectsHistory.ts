import {
	IoTActionRole,
	PackedLambdaFn,
} from '@bifravst/aws-cdk-lambda-helpers/cdk'
import type { aws_lambda as Lambda } from 'aws-cdk-lib'
import {
	aws_iam as IAM,
	aws_iot as IoT,
	RemovalPolicy,
	aws_timestream as Timestream,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../BackendLambdas.ts'

/**
 * Store history of LwM2M objects
 */
export class LwM2MObjectsHistory extends Construct {
	public readonly storeFn: PackedLambdaFn
	public readonly table: Timestream.CfnTable
	public readonly db: Timestream.CfnDatabase
	public constructor(
		parent: Construct,
		{
			lambdaSources,
			layers,
		}: {
			lambdaSources: Pick<BackendLambdas, 'storeObjectsInTimestream'>
			layers: Array<Lambda.ILayerVersion>
		},
	) {
		super(parent, LwM2MObjectsHistory.name)

		this.db = new Timestream.CfnDatabase(this, 'lwm2mObjectsHistoryDb')
		this.table = new Timestream.CfnTable(this, 'lwm2mObjectsHistoryTable', {
			databaseName: this.db.ref,
			retentionProperties: {
				MemoryStoreRetentionPeriodInHours: `24`,
				MagneticStoreRetentionPeriodInDays: '1',
			},
		})

		this.db.applyRemovalPolicy(RemovalPolicy.DESTROY)

		this.storeFn = new PackedLambdaFn(
			this,
			'storeFn',
			lambdaSources.storeObjectsInTimestream,
			{
				description: 'Stores LwM2M objects into Timestream database',
				environment: {
					HISTORICAL_DATA_TABLE_INFO: this.table.ref,
				},
				layers,
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['timestream:WriteRecords'],
						resources: [this.table.attrArn],
					}),
					new IAM.PolicyStatement({
						actions: ['timestream:DescribeEndpoints'],
						resources: ['*'],
					}),
				],
			},
		)

		const ruleRole = new IoTActionRole(this).role
		const rule = new IoT.CfnTopicRule(this, 'rule', {
			topicRulePayload: {
				description: `Convert shadow updates to LwM2M`,
				ruleDisabled: false,
				awsIotSqlVersion: '2016-03-23',
				sql: [
					`SELECT state.reported as reported,`,
					`topic(3) as deviceId,`,
					`FROM '$aws/things/+/shadow/name/lwm2m/update/accepted'`,
					`WHERE isUndefined(state.reported) = false`,
				].join(' '),
				actions: [
					{
						lambda: {
							functionArn: this.storeFn.fn.functionArn,
						},
					},
				],
				errorAction: {
					republish: {
						roleArn: ruleRole.roleArn,
						topic: 'errors',
					},
				},
			},
		})

		this.storeFn.fn.addPermission('invokeByRule', {
			principal: new IAM.ServicePrincipal(
				'iot.amazonaws.com',
			) as IAM.IPrincipal,
			sourceArn: rule.attrArn,
		})
	}
}
