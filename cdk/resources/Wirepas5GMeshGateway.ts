import type { Stack } from 'aws-cdk-lib'
import { aws_iam as IAM } from 'aws-cdk-lib'
import { Construct } from 'constructs'

export class Wirepas5GMeshGateway extends Construct {
	public readonly accessKey
	constructor(parent: Stack) {
		super(parent, 'Wirepas5GMeshGateway')

		const gatewayUser = new IAM.User(this, 'gatewayUser')
		gatewayUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: [
					'iot:DescribeEndpoint',
					'iot:UpdateThingShadow',
					'iot:ListThings',
				],
				resources: [`*`],
			}),
		)

		this.accessKey = new IAM.CfnAccessKey(this, 'accessKey', {
			userName: gatewayUser.userName,
			status: 'Active',
		})
	}
}
