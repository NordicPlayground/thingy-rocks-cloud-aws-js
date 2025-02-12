import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import {
	aws_iam as IAM,
	aws_iot as IoT,
	type aws_lambda as Lambda,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../BackendLambdas.js'
import type { WebsocketAPI } from './WebsocketAPI.ts'

/**
 * Resources for devices that act as Gateways for other devices and publish LwM2mM objects in SenML
 */
export class LwM2MDataGateway extends Construct {
	public readonly thingPolicy: IoT.CfnPolicy
	constructor(
		parent: Construct,
		{
			lambdaSources,
			baseLayer,
			websocketAPI,
		}: {
			lambdaSources: Pick<BackendLambdas, 'lwm2mGateway'>
			baseLayer: Lambda.ILayerVersion
			websocketAPI: WebsocketAPI
		},
	) {
		super(parent, LwM2MDataGateway.name)

		/**
		 * Assign this to the thing group for the Gateway devices
		 */
		this.thingPolicy = new IoT.CfnPolicy(this, 'policy', {
			policyName: 'LwM2MDataGatewayPolicy',
			policyDocument: {
				Version: '2012-10-17',
				Statement: [
					{
						Effect: 'Allow',
						Action: ['iot:Connect'],
						Resource: ['arn:aws:iot:*:*:client/${iot:ClientId}'],
						Condition: {
							Bool: {
								'iot:Connection.Thing.IsAttached': [true],
							},
						},
					},
					{
						Effect: 'Allow',
						Action: ['iot:Publish'],
						Resource: [
							'arn:aws:iot:*:*:topic/${iot:ClientId}/lwm2m-gateway/senml/*',
						],
					},
				],
			},
		})

		const lwm2mGatewayFn = new PackedLambdaFn(
			this,
			'lwm2mGatewayFn',
			lambdaSources.lwm2mGateway,
			{
				description:
					'Update Thing shadows with LwM2M objects sent by a Gateway device',
				layers: [baseLayer],
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['iot:UpdateThingShadow', 'iot:DescribeThing'],
						resources: ['*'],
					}),
					new IAM.PolicyStatement({
						actions: ['execute-api:ManageConnections'],
						resources: [websocketAPI.websocketAPIArn],
					}),
				],
				environment: {
					CONNECTIONS_TABLE_NAME: websocketAPI.connectionsTable.tableName,
					WEBSOCKET_MANAGEMENT_API_URL: websocketAPI.websocketManagementAPIURL,
				},
			},
		)

		websocketAPI.connectionsTable.grantReadWriteData(lwm2mGatewayFn.fn)

		const ruleRole = new IAM.Role(this, 'ruleRole', {
			assumedBy: new IAM.ServicePrincipal(
				'iot.amazonaws.com',
			) as IAM.IPrincipal,
			inlinePolicies: {
				rootPermissions: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							actions: ['iot:Publish'],
							resources: [
								`arn:aws:iot:${Stack.of(parent).region}:${
									Stack.of(parent).account
								}:topic/errors`,
							],
						}),
					],
				}),
			},
		})

		const rule = new IoT.CfnTopicRule(this, 'rule', {
			topicRulePayload: {
				description: `Receive LwM2M objects from gateways`,
				ruleDisabled: false,
				awsIotSqlVersion: '2016-03-23',
				sql: [
					`SELECT * as senML,`,
					`topic(1) as gatewayId,`,
					`topic(4) as deviceId,`,
					`timestamp() as timestamp`,
					`FROM '+/lwm2m-gateway/senml/+'`,
				].join(' '),
				actions: [
					{
						lambda: {
							functionArn: lwm2mGatewayFn.fn.functionArn,
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

		lwm2mGatewayFn.fn.addPermission('invokeByRule', {
			principal: new IAM.ServicePrincipal(
				'iot.amazonaws.com',
			) as IAM.IPrincipal,
			sourceArn: rule.attrArn,
		})
	}
}
