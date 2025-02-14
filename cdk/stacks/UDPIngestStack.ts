import { repositoryName } from '@bifravst/aws-cdk-ecr-helpers/repository'
import type { App, Environment } from 'aws-cdk-lib'
import { CfnOutput, aws_ecr as ECR, aws_ecs as ECS, Stack } from 'aws-cdk-lib'
import { ContainerRepositoryId } from '../../aws/ecr.ts'
import { UDPIngest } from '../resources/UDPIngest.ts'
import { UDP_INGEST_STACK_NAME } from './stackName.ts'

export class UDPIngestStack extends Stack {
	public constructor(
		parent: App,
		{
			udpIngestContainerTag,
			env,
		}: {
			udpIngestContainerTag: string
			env: Required<Environment>
		},
	) {
		super(parent, UDP_INGEST_STACK_NAME, {
			env,
		})

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
		})

		new CfnOutput(this, 'UDPIngestContainerTag', {
			exportName: `${this.stackName}:UDPIngestContainerTag`,
			description: 'The DNS name of the CoAP endpoint',
			value: updIngest.service.loadBalancer.loadBalancerDnsName,
		})

		new CfnOutput(this, 'UDPIngestPublicIP', {
			exportName: `${this.stackName}:UDPIngest`,
			description: 'The DNS name of the CoAP endpoint',
			value: updIngest.service.loadBalancer.loadBalancerDnsName,
		})
	}
}

export type StackOutputs = {
	UDPIngestPublicIP: string
}
