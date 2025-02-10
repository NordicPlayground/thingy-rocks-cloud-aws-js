import { repositoryName } from '@bifravst/aws-cdk-ecr-helpers/repository'
import type { App, Environment } from 'aws-cdk-lib'
import { CfnOutput, aws_ecr as ECR, aws_ecs as ECS, Stack } from 'aws-cdk-lib'
import { ContainerRepositoryId } from '../../aws/ecr.ts'
import { CoAPEndpoint } from '../resources/CoAPEndpoint.ts'
import { UDP_INGEST_STACK_NAME } from './stackName.ts'

export class UDPIngestStack extends Stack {
	public constructor(
		parent: App,
		{
			coAPEndpointContainerTag,
			env,
		}: {
			coAPEndpointContainerTag: string
			env: Required<Environment>
		},
	) {
		super(parent, UDP_INGEST_STACK_NAME, {
			env,
		})

		const coapEndpoint = new CoAPEndpoint(this, {
			image: ECS.ContainerImage.fromEcrRepository(
				ECR.Repository.fromRepositoryName(
					this,
					'coap-endpoint-ecr',
					repositoryName({
						stackName: Stack.of(this).stackName,
						id: ContainerRepositoryId.CoAPEndpoint,
					}),
				),
				coAPEndpointContainerTag,
			),
		})

		new CfnOutput(this, 'coAPEndpointPublicIP', {
			exportName: `${this.stackName}:coAPEndpoint`,
			description: 'The DNS name of the CoAP endpoint',
			value: coapEndpoint.service.loadBalancer.loadBalancerDnsName,
		})
	}
}

export type StackOutputs = {
	coAPEndpointPublicIP: string
}
