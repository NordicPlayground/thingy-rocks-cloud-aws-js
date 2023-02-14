import type { Stack } from 'aws-cdk-lib'
import { aws_iam as IAM } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { WebsocketAPI } from './WebsocketAPI'

export class Wirepas5GMeshGateway extends Construct {
	public readonly accessKey
	constructor(parent: Stack, { websocketAPI }: { websocketAPI: WebsocketAPI }) {
		super(parent, 'Wirepas5GMeshGateway')

		const gatewayUser = new IAM.User(this, 'gatewayUser')
		gatewayUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['iot:DescribeEndpoint'],
				resources: [`*`],
			}),
		)
		gatewayUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['execute-api:ManageConnections'],
				resources: [websocketAPI.websocketAPIArn],
			}),
		)
		websocketAPI.connectionsTable.grantFullAccess(gatewayUser)

		this.accessKey = new IAM.CfnAccessKey(this, 'accessKey', {
			userName: gatewayUser.userName,
			status: 'Active',
		})
	}
}
