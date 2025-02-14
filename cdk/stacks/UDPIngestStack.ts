import { repositoryName } from '@bifravst/aws-cdk-ecr-helpers/repository'
import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import type { PackedLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import type { App, Environment } from 'aws-cdk-lib'
import {
	CfnOutput,
	aws_ecr as ECR,
	aws_ecs as ECS,
	Fn,
	aws_lambda as Lambda,
	Stack,
} from 'aws-cdk-lib'
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53'
import { LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { ContainerRepositoryId } from '../../aws/ecr.ts'
import type { BackendLambdas } from '../BackendLambdas.js'
import { UDPIngest } from '../resources/UDPIngest.ts'
import { UDP_INGEST_STACK_NAME } from './stackName.ts'

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
			lambdaSources: Pick<BackendLambdas, 'processUPDPackets'>
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
			compatibleRuntimes: [Lambda.Runtime.NODEJS_22_X],
		})

		const queue = new Queue(this, 'queue')

		const updIngest = new UDPIngest(this, {
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

		new CfnOutput(this, 'NLBDnsName', {
			exportName: `${this.stackName}:NLBDnsName`,
			description: 'The DNS name of the NLB',
			value: updIngest.nlb.loadBalancerDnsName,
		})

		const hostedZone = new HostedZone(this, 'zone', {
			zoneName: 'ingress.thingy.rocks',
		})

		new ARecord(this, 'AliasRecord', {
			zone: hostedZone,
			target: RecordTarget.fromAlias(new LoadBalancerTarget(updIngest.nlb)),
			recordName: 'udp',
		})

		new CfnOutput(this, 'hostedZoneName', {
			value: hostedZone.zoneName,
			description: 'The hosted zone name',
		})
		new CfnOutput(this, 'hostedZoneNameServers', {
			value: Fn.join(',', hostedZone.hostedZoneNameServers!),
			description: 'The hosted zone name servers',
		})

		new PackedLambdaFn(
			this,
			'processUPDPackets',
			lambdaSources.processUPDPackets,
			{
				events: [new SqsEventSource(queue)],
				description: 'Process UDP packets',
				layers: [baseLayer],
			},
		)
	}
}

export type StackOutputs = {
	UDPIngestPublicIP: string
}
