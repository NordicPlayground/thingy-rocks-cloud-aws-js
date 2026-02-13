import {
	aws_cognito as Cognito,
	aws_iam as IAM,
	RemovalPolicy,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'

export type UserAuthenticationProps = {
	/**
	 * OAuth callback and logout URLs for the Hosted UI.
	 * Must include the URLs where your web app runs (e.g. https://app.example.com/ and http://localhost:8080/ for local dev).
	 */
	redirectUrls?: string[]
}

const DEFAULT_REDIRECT_URLS = [
	'http://localhost:8080/',
	'https://world.thingy.rocks/',
]

export class UserAuthentication extends Construct {
	public readonly authenticatedUserRole: IAM.IRole
	public readonly unauthenticatedUserRole: IAM.IRole
	public readonly identityPool: Cognito.CfnIdentityPool
	public readonly userPool: Cognito.UserPool
	public readonly userPoolClient: Cognito.UserPoolClient
	public readonly domain: Cognito.UserPoolDomain

	constructor(
		parent: Construct,
		id: string,
		props: UserAuthenticationProps = {},
	) {
		super(parent, id)

		const redirectUrls =
			(props.redirectUrls?.length ?? 0) > 0
				? props.redirectUrls!
				: DEFAULT_REDIRECT_URLS

		this.userPool = new Cognito.UserPool(this, 'userPool', {
			signInAliases: {
				email: true,
			},
			autoVerify: {
				email: true,
			},
			selfSignUpEnabled: true,
			passwordPolicy: {
				requireSymbols: false,
			},
			accountRecovery: Cognito.AccountRecovery.EMAIL_ONLY,
			removalPolicy: RemovalPolicy.DESTROY,
		})

		this.domain = new Cognito.UserPoolDomain(this, 'userPoolDomain', {
			userPool: this.userPool,
			cognitoDomain: {
				domainPrefix: `thingy-rocks-${Stack.of(this).account}`,
			},
		})

		this.userPoolClient = new Cognito.UserPoolClient(this, 'userPoolClient', {
			userPool: this.userPool,
			authFlows: {
				userPassword: true,
				userSrp: true,
				adminUserPassword: true,
			},
			oAuth: {
				flows: {
					authorizationCodeGrant: true,
				},
				scopes: [
					Cognito.OAuthScope.EMAIL,
					Cognito.OAuthScope.PROFILE,
					Cognito.OAuthScope.OPENID,
				],
				callbackUrls: redirectUrls,
				logoutUrls: redirectUrls,
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
				inlinePolicies: {},
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
