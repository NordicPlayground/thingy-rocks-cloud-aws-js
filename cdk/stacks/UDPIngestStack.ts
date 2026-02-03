import { repositoryName } from '@bifravst/aws-cdk-ecr-helpers/repository'
import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import type { PackedLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import type { App, Environment } from 'aws-cdk-lib'
import {
	CfnOutput,
	Duration,
	aws_dynamodb as DynamoDB,
	aws_ecr as ECR,
	aws_ecs as ECS,
	Fn,
	aws_iam as IAM,
	aws_lambda as Lambda,
	RemovalPolicy,
	Stack,
} from 'aws-cdk-lib'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { ContainerRepositoryId } from '../../aws/ecr.ts'
import type { BackendLambdas } from '../BackendLambdas.ts'
import { UDPIngest } from '../resources/UDPIngest.ts'
import { STACK_NAME, UDP_INGEST_STACK_NAME } from './stackName.ts'

export class UDPIngestStack extends Stack {
	public constructor(
		parent: App,
		{
			udpIngestContainerTag,
			env,
			lambdaSources,
			layer,
		}: {
			udpIngestContainerTag: string
			env: Required<Environment>
			lambdaSources: Pick<
				BackendLambdas,
				'processUPDPackets' | 'udpDatagramsLogs'
			>
			layer: PackedLayer
		},
	) {
		super(parent, UDP_INGEST_STACK_NAME, {
			env,
			description: 'Provide an UDP ingest endpoint',
		})

		const baseLayer = new Lambda.LayerVersion(this, 'baseLayer', {
			layerVersionName: `${Stack.of(this).stackName}-baseLayer`,
			code: Lambda.Code.fromAsset(layer.layerZipFilePath),
			compatibleArchitectures: [Lambda.Architecture.ARM_64],
			compatibleRuntimes: [Lambda.Runtime.NODEJS_24_X],
		})

		const queue = new Queue(this, 'queue')

		new UDPIngest(this, {
			image: ECS.ContainerImage.fromEcrRepository(
				ECR.Repository.fromRepositoryName(
					this,
					'udp-ingest-ecr',
					repositoryName({
						stackName: Stack.of(this).stackName,
						id: ContainerRepositoryId.UDPIngest,
					}),
				),
				udpIngestContainerTag,
			),
			queue,
		})

		// Make message conversion results available
		const udpDatagramsTable = new DynamoDB.Table(this, 'table', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'deviceId',
				type: DynamoDB.AttributeType.STRING,
			},
			sortKey: {
				name: 'messageId',
				type: DynamoDB.AttributeType.STRING,
			},
			timeToLiveAttribute: 'ttl',
			removalPolicy: RemovalPolicy.DESTROY,
		})

		const processUPDPacketsFn = new PackedLambdaFn(
			this,
			'processUPDPackets',
			lambdaSources.processUPDPackets,
			{
				events: [new SqsEventSource(queue)],
				description: 'Process UDP packets',
				layers: [baseLayer],
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: [
							'iot:UpdateThingShadow',
							'iot:DescribeThing',
							'iot:Publish',
						],
						resources: ['*'],
					}),
					new IAM.PolicyStatement({
						actions: ['execute-api:ManageConnections'],
						resources: [
							Fn.importValue(`${STACK_NAME}:WebSocketManagementApiARN`),
						],
					}),
				],
				environment: {
					CONNECTIONS_TABLE_NAME: Fn.importValue(
						`${STACK_NAME}:connectionsTableName`,
					),
					WEBSOCKET_MANAGEMENT_API_URL: Fn.importValue(
						`${STACK_NAME}:WebSocketManagementApiURL`,
					),
					UDP_DATAGRAMS_TABLE_NAME: udpDatagramsTable.tableName,
				},
			},
		)
		udpDatagramsTable.grantWriteData(processUPDPacketsFn.fn)

		const connectionsTable = Table.fromTableName(
			this,
			'connectionsTableName',
			Fn.importValue(`${STACK_NAME}:connectionsTableName`),
		)
		connectionsTable.grantReadWriteData(processUPDPacketsFn.fn)

		const udpDatagramsLogsFn = new PackedLambdaFn(
			this,
			'udpDatagramsLogsFn',
			lambdaSources.udpDatagramsLogs,
			{
				timeout: Duration.minutes(1),
				description:
					'Returns the last UDP datagrams conversion results for a device.',
				layers: [baseLayer],
				environment: {
					UDP_DATAGRAMS_TABLE_NAME: udpDatagramsTable.tableName,
				},
			},
		)
		udpDatagramsTable.grantReadData(udpDatagramsLogsFn.fn)

		const udpDatagramsLogsFnUrl = udpDatagramsLogsFn.fn.addFunctionUrl({
			authType: Lambda.FunctionUrlAuthType.NONE,
		})

		new CfnOutput(this, 'udpDatagramsLogsUrl', {
			value: udpDatagramsLogsFnUrl.url,
			description:
				'The URL to retrieve the last UDP datagrams conversion results',
		})
	}
}
