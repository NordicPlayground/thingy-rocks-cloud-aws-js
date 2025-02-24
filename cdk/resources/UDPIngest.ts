import { Duration, aws_ec2 as EC2, aws_ecs as ECS, Stack } from 'aws-cdk-lib'
import { Subnet } from 'aws-cdk-lib/aws-ec2'
import type { CfnService, ContainerImage } from 'aws-cdk-lib/aws-ecs'
import { FargateService, LogDriver } from 'aws-cdk-lib/aws-ecs'
import {
	NetworkLoadBalancer,
	NetworkTargetGroup,
	Protocol,
	type CfnLoadBalancer,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import {
	ManagedPolicy,
	Role,
	ServicePrincipal,
	type IRole,
} from 'aws-cdk-lib/aws-iam'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import type { IQueue } from 'aws-cdk-lib/aws-sqs'
import { Construct } from 'constructs'

const HEALTH_CHECK_PORT = 8080
const UDP_PORT = 6666

export class UDPIngest extends Construct {
	public readonly nlb: NetworkLoadBalancer
	public readonly taskRole: IRole
	public constructor(
		parent: Construct,
		{
			image,
			queue,
		}: {
			image: ContainerImage
			queue: IQueue
		},
	) {
		super(parent, UDPIngest.name)

		const vpc = EC2.Vpc.fromLookup(this, 'DefaultVPC', { isDefault: true })

		const securityGroup = new EC2.SecurityGroup(this, 'sg', {
			vpc,
			allowAllOutbound: true,
			securityGroupName: 'UDPIngestSG',
		})

		securityGroup.addIngressRule(
			EC2.Peer.anyIpv4(),
			EC2.Port.udp(UDP_PORT),
			'allow UDP',
		)

		securityGroup.addIngressRule(
			EC2.Peer.anyIpv4(),
			EC2.Port.tcp(HEALTH_CHECK_PORT),
			'allow health check',
		)

		this.taskRole = new Role(this, 'TaskRole', {
			assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
			managedPolicies: [
				ManagedPolicy.fromAwsManagedPolicyName(
					'service-role/AmazonECSTaskExecutionRolePolicy',
				),
			],
		})

		const imageTask = new ECS.FargateTaskDefinition(this, 'imageTask', {
			taskRole: this.taskRole,
		})

		queue.grantSendMessages(this.taskRole)

		const container = imageTask.addContainer('UDPIngestContainer', {
			cpu: 256,
			memoryLimitMiB: 512,
			logging: LogDriver.awsLogs({
				streamPrefix: 'udp-ingest',
				logRetention: RetentionDays.ONE_DAY,
			}),
			image,
			secrets: {},
			environment: {
				SQS_QUEUE_URL: queue.queueUrl,
				AWS_REGION: Stack.of(this).region,
			},
			healthCheck: {
				// Tip: 'use "curl ... >> /proc/1/fd/1 2>&1" to log the output of the health check to the container's stdout'
				command: [
					'CMD-SHELL',
					`curl -f http://localhost:${HEALTH_CHECK_PORT}/health || exit 1`,
				],
				interval: Duration.minutes(1),
				retries: 3,
			},
		})

		container.addPortMappings({
			containerPort: HEALTH_CHECK_PORT,
			hostPort: HEALTH_CHECK_PORT,
			protocol: ECS.Protocol.TCP,
		})

		container.addPortMappings({
			containerPort: UDP_PORT,
			hostPort: UDP_PORT,
			protocol: ECS.Protocol.UDP,
		})

		const cluster = new ECS.Cluster(this, 'Cluster', {
			vpc,
		})

		const service = new FargateService(this, 'UDPIngestService', {
			cluster,
			desiredCount: 1,
			taskDefinition: imageTask,
			assignPublicIp: true,
			healthCheckGracePeriod: Duration.seconds(60),
			minHealthyPercent: 0,
			maxHealthyPercent: 100,
			securityGroups: [securityGroup],
		})

		this.nlb = new NetworkLoadBalancer(this, 'NLBfixedIP', {
			vpc,
			internetFacing: true,
			securityGroups: [securityGroup],
		})

		const publicIpSubnet = Subnet.fromSubnetId(
			this,
			'subnetWithStaticIP',
			this.node.getContext(
				`publicIpSubnet:${Stack.of(this).account}:${Stack.of(this).region}`,
			),
		)

		// No high-level API yet for SubnetMappings: https://github.com/aws/aws-cdk/issues/9696
		const cfnNLB = this.nlb.node.defaultChild as CfnLoadBalancer

		const subnetMapping1: CfnLoadBalancer.SubnetMappingProperty = {
			subnetId: publicIpSubnet.subnetId,
			allocationId: this.node.getContext(
				`publicIpAllocation:${Stack.of(this).account}:${Stack.of(this).region}`,
			),
		}

		cfnNLB.subnetMappings = [subnetMapping1]
		cfnNLB.subnets = undefined

		const forwardTCP = new NetworkTargetGroup(this, 'healthCheckTG', {
			targets: [service],
			port: HEALTH_CHECK_PORT,
			protocol: Protocol.TCP,
			vpc,
		})

		this.nlb.addListener('tcpListener', {
			port: HEALTH_CHECK_PORT,
			protocol: Protocol.TCP,
			defaultTargetGroups: [forwardTCP],
		})

		const forwardUDP = new NetworkTargetGroup(this, 'udpIngressTG', {
			targets: [service],
			port: UDP_PORT,
			protocol: Protocol.UDP,
			vpc,
			// All targets must have TCP health check
			healthCheck: {
				port: `${HEALTH_CHECK_PORT}`,
			},
		})

		this.nlb.addListener('udpListener', {
			port: UDP_PORT,
			protocol: Protocol.UDP,
			defaultTargetGroups: [forwardUDP],
		})
		;(service.node.defaultChild as CfnService).addPropertyOverride(
			'LoadBalancers.1.ContainerPort',
			UDP_PORT,
		)
	}
}
