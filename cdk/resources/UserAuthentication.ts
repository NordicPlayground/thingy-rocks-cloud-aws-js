import {
	aws_cognito as Cognito,
	aws_iam as IAM,
	RemovalPolicy,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'

export class UserAuthentication extends Construct {
	public readonly authenticatedUserRole: IAM.IRole
	public readonly unauthenticatedUserRole: IAM.IRole
	public readonly identityPool: Cognito.CfnIdentityPool
	public readonly userPool: Cognito.UserPool
	public readonly userPoolClient: Cognito.UserPoolClient
	constructor(parent: Construct, id: string) {
		super(parent, id)

		this.userPool = new Cognito.UserPool(this, 'userPool', {
			signInAliases: {
				email: true,
			},
			autoVerify: {
				email: true,
			},
			selfSignUpEnabled: false,
			passwordPolicy: {
				requireSymbols: false,
			},
			accountRecovery: Cognito.AccountRecovery.EMAIL_ONLY,
			removalPolicy: RemovalPolicy.DESTROY,
		})

		this.userPoolClient = new Cognito.UserPoolClient(this, 'userPoolClient', {
			userPool: this.userPool,
			authFlows: {
				userPassword: true,
				userSrp: true,
				adminUserPassword: true,
			},
		})
		this.identityPool = new Cognito.CfnIdentityPool(this, 'identityPool', {
			allowUnauthenticatedIdentities: true,
			cognitoIdentityProviders: [
				{
					clientId: this.userPoolClient.userPoolClientId,
					providerName: this.userPool.userPoolProviderName,
				},
			],
		})

		this.authenticatedUserRole = new IAM.Role(this, 'userRole', {
			assumedBy: new IAM.FederatedPrincipal(
				'cognito-identity.amazonaws.com',
				{
					StringEquals: {
						'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
					},
					'ForAnyValue:StringLike': {
						'cognito-identity.amazonaws.com:amr': 'authenticated',
					},
				},
				'sts:AssumeRoleWithWebIdentity',
			) as IAM.IPrincipal,
			inlinePolicies: {},
		}) as IAM.IRole

		this.unauthenticatedUserRole = new IAM.Role(
			this,
			'unauthenticatedUserRole',
			{
				assumedBy: new IAM.FederatedPrincipal(
					'cognito-identity.amazonaws.com',
					{
						StringEquals: {
							'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
						},
						'ForAnyValue:StringLike': {
							'cognito-identity.amazonaws.com:amr': 'unauthenticated',
						},
					},
					'sts:AssumeRoleWithWebIdentity',
				) as IAM.IPrincipal,
				inlinePolicies: {
					kinesisVideo: new IAM.PolicyDocument({
						statements: [
							new IAM.PolicyStatement({
								actions: [
									'kinesisvideo:GetDataEndpoint',
									'kinesisvideo:GetImages',
									'kinesisvideo:GetHLSStreamingSessionURL',
									'kinesisvideo:GetDASHStreamingSessionURL',
									'kinesisvideo:DescribeStream',
								],
								resources: [
									`arn:aws:kinesisvideo:*:${Stack.of(this).account}:stream/*`,
								],
							}),
						],
					}),
				},
			},
		) as IAM.IRole

		new Cognito.CfnIdentityPoolRoleAttachment(this, 'identityPoolRoles', {
			identityPoolId: this.identityPool.ref.toString(),
			roles: {
				authenticated: this.authenticatedUserRole.roleArn,
				unauthenticated: this.unauthenticatedUserRole.roleArn,
			},
		})
	}
}
