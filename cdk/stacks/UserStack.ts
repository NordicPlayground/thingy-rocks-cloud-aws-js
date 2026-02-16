import type { App } from 'aws-cdk-lib'
import { CfnOutput, Stack } from 'aws-cdk-lib'
import { UserAuthentication } from '../resources/UserAuthentication.ts'
import { USER_STACK_NAME } from './stackName.ts'

export class UserStack extends Stack {
	public constructor(parent: App) {
		super(parent, USER_STACK_NAME)

		const userAuthentication = new UserAuthentication(this, {
			redirectUrls: process.env.COGNITO_REDIRECT_URLS?.split(',')
				.map((s) => s.trim())
				.filter(Boolean),
		})

		new CfnOutput(this, 'identityPoolId', {
			value: userAuthentication.identityPool.ref,
			exportName: `${this.stackName}:identityPoolId`,
		})

		new CfnOutput(this, 'authenticatedUserRoleArn', {
			value: userAuthentication.authenticatedUserRole.roleArn,
			exportName: `${this.stackName}:authenticatedUserRoleArn`,
		})
		new CfnOutput(this, 'unauthenticatedUserRoleArn', {
			value: userAuthentication.unauthenticatedUserRole.roleArn,
			exportName: `${this.stackName}:unauthenticatedUserRoleArn`,
		})

		new CfnOutput(this, 'userPoolClientId', {
			value: userAuthentication.userPoolClient.userPoolClientId,
			description: 'Cognito User Pool Client ID',
			exportName: `${Stack.of(this).stackName}:userPoolClientId`,
		})

		new CfnOutput(this, 'userPoolId', {
			value: userAuthentication.userPool.userPoolId,
			description: 'Cognito User Pool ID',
			exportName: `${Stack.of(this).stackName}:userPoolId`,
		})

		new CfnOutput(this, 'userPoolProviderName', {
			value: userAuthentication.userPool.userPoolProviderName,
			description: 'Cognito User Pool Provider Name',
			exportName: `${Stack.of(this).stackName}:userPoolProviderName`,
		})

		new CfnOutput(this, 'cognitoDomainUrl', {
			value: userAuthentication.domain.baseUrl(),
			description: 'Cognito Hosted UI domain URL for managed login',
			exportName: `${Stack.of(this).stackName}:cognitoDomainUrl`,
		})
	}
}

export type StackOutputs = {
	identityPoolId: string
	authenticatedUserRoleArn: string
	unauthenticatedUserRoleArn: string
	userPoolClientId: string
	userPoolId: string
	userPoolProviderName: string
	cognitoDomainUrl: string
}
