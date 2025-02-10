import {
	aws_ec2 as EC2,
	aws_ecs as ECS,
	aws_ecs_patterns as ECSPatterns,
} from 'aws-cdk-lib'
import type { ContainerImage } from 'aws-cdk-lib/aws-ecs'
import { LogDriver } from 'aws-cdk-lib/aws-ecs'
import { IpAddressType } from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

export class CoAPEndpoint extends Construct {
	public readonly service: ECSPatterns.NetworkLoadBalancedFargateService
	public constructor(
		parent: Construct,
		{
			image,
		}: {
			image: ContainerImage
		},
	) {
		super(parent, CoAPEndpoint.name)

		const vpc = EC2.Vpc.fromLookup(this, 'DefaultVPC', { isDefault: true })

		const imageTask = new ECS.FargateTaskDefinition(this, 'imageTask')

		const container = imageTask.addContainer('coAPEndpointContainer', {
			cpu: 256,
			memoryLimitMiB: 512,
			logging: LogDriver.awsLogs({
				streamPrefix: 'coap-endpoint',
				logRetention: RetentionDays.ONE_DAY,
			}),
			image,
			secrets: {},
			environment: {},
		})

		container.addPortMappings({
			containerPort: 5683,
			hostPort: 5683,
			protocol: ECS.Protocol.UDP,
		})

		this.service = new ECSPatterns.NetworkLoadBalancedFargateService(
			this,
			'Service',
			{
				vpc,
				cpu: 256,
				memoryLimitMiB: 512,
				assignPublicIp: true,
				listenerPort: 5683,
				ipAddressType: IpAddressType.DUAL_STACK,
				taskDefinition: imageTask,
			},
		)
	}
}
