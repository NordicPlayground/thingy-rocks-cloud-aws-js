import type { Stack } from 'aws-cdk-lib'
import { aws_iam as IAM } from 'aws-cdk-lib'
import { Construct } from 'constructs'

export class FirmwareCI extends Construct {
	public readonly accessKey
	constructor(parent: Stack) {
		super(parent, 'FirmwareCI')

		const ciUser = new IAM.User(this, 'ciUser')
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['iot:DescribeEndpoint'],
				resources: [`*`],
			}),
		)
		this.accessKey = new IAM.CfnAccessKey(this, 'accessKey', {
			userName: ciUser.userName,
			status: 'Active',
		})
	}
}
