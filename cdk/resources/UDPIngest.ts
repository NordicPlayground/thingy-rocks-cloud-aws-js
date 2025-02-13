import {
	Duration,
	aws_ec2 as EC2,
	aws_ecs as ECS,
	aws_ecs_patterns as ECSPatterns,
} from 'aws-cdk-lib'
import type { ContainerImage } from 'aws-cdk-lib/aws-ecs'
import { LogDriver } from 'aws-cdk-lib/aws-ecs'
import { IpAddressType } from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

export class UDPIngest extends Construct {
	public readonly service: ECSPatterns.NetworkLoadBalancedFargateService
	public constructor(
		parent: Construct,
		{
			image,
		}: {
			image: ContainerImage
		},
	) {
		super(parent, UDPIngest.name)

		const vpc = EC2.Vpc.fromLookup(this, 'DefaultVPC', { isDefault: true })

		const imageTask = new ECS.FargateTaskDefinition(this, 'imageTask')

		const container = imageTask.addContainer('UDPIngestContainer', {
			cpu: 256,
			memoryLimitMiB: 512,
			logging: LogDriver.awsLogs({
				streamPrefix: 'udp-ingest',
				logRetention: RetentionDays.ONE_DAY,
			}),
			image,
			secrets: {},
			environment: {},
			healthCheck: {
				command: ['CMD-SHELL', 'curl -f http://localhost/health || exit 1'],
				interval: Duration.minutes(1),
				retries: 3,
			},
		})

		container.addPortMappings({
			containerPort: 80,
			hostPort: 80,
			protocol: ECS.Protocol.TCP,
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
				ipAddressType: IpAddressType.IPV4,
				taskDefinition: imageTask,
			},
		)
	}
}
