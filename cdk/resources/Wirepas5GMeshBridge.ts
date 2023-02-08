import type { Stack } from 'aws-cdk-lib'
import { aws_iam as IAM } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { WebsocketAPI } from './WebsocketAPI'

export class Wirepas5GMeshBridge extends Construct {
	public readonly accessKey
	constructor(parent: Stack, { websocketAPI }: { websocketAPI: WebsocketAPI }) {
		super(parent, 'Wirepas5GMeshBridge')

		const bridgeUser = new IAM.User(this, 'bridgeUser')
		bridgeUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['iot:DescribeEndpoint'],
				resources: [`*`],
			}),
		)
		bridgeUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['execute-api:ManageConnections'],
				resources: [websocketAPI.websocketAPIArn],
			}),
		)
		websocketAPI.connectionsTable.grantFullAccess(bridgeUser)

		this.accessKey = new IAM.CfnAccessKey(this, 'accessKey', {
			userName: bridgeUser.userName,
			status: 'Active',
		})
	}
}
