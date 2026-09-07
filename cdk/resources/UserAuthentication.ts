import {
	aws_cognito as Cognito,
	Duration,
	aws_iam as IAM,
	RemovalPolicy,
	Stack,
} from 'aws-cdk-lib'
import {
	CfnManagedLoginBranding,
	PasskeyUserVerification,
	VerificationEmailStyle,
} from 'aws-cdk-lib/aws-cognito'
import { Construct } from 'constructs'

export type UserAuthenticationProps = {
	/**
	 * OAuth callback and logout URLs for the Hosted UI.
	 * Must include the URLs where your web app runs (e.g. https://app.example.com/ and http://localhost:8080/ for local dev).
	 */
	redirectUrls?: string[]
}

const DEFAULT_REDIRECT_URLS = [
	'http://localhost:8080',
	'https://world.thingy.rocks',
	'nrfcloud://thingy-auth', // for the mobile app
]

export class UserAuthentication extends Construct {
	public readonly authenticatedUserRole: IAM.IRole
	public readonly unauthenticatedUserRole: IAM.IRole
	public readonly identityPool: Cognito.CfnIdentityPool
	public readonly userPool: Cognito.UserPool
	public readonly userPoolClient: Cognito.UserPoolClient
	public readonly domain: Cognito.UserPoolDomain
	/** Base URL for Cognito Hosted UI (Managed UI). Use this to redirect users to sign-in/sign-up. */
	public readonly hostedUiUrl: string

	constructor(parent: Construct, props: UserAuthenticationProps = {}) {
		super(parent, UserAuthentication.name)

		const redirectUrls =
			(props.redirectUrls?.length ?? 0) > 0
				? props.redirectUrls!
				: DEFAULT_REDIRECT_URLS

		this.userPool = new Cognito.UserPool(this, 'userPool', {
			selfSignUpEnabled: true,
			standardAttributes: {
				email: {
					required: true,
					mutable: true,
				},
				fullname: {
					required: true,
					mutable: true,
				},
			},
			autoVerify: {
				email: true,
			},
			signInPolicy: {
				allowedFirstAuthFactors: {
					// The password authentication cannot be disabled right now.
					password: true,
					emailOtp: true,
					passkey: true,
				},
			},
			passkeyUserVerification: PasskeyUserVerification.PREFERRED,
			removalPolicy: RemovalPolicy.DESTROY,
			featurePlan: Cognito.FeaturePlan.ESSENTIALS,
			userVerification: {
				emailSubject: '[world.thingy.rocks] Verify your email',
				emailBody: 'Your verification code is {####}.',
				emailStyle: VerificationEmailStyle.CODE,
			},
		})

		this.domain = new Cognito.UserPoolDomain(this, 'userPoolDomain', {
			userPool: this.userPool,
			cognitoDomain: {
				domainPrefix: `thingy-rocks-${Stack.of(this).account}`,
			},
			// Passwordless flows (e.g. email OTP) only work with newer managed login, not classic Hosted UI.
			managedLoginVersion: Cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN,
		})
		this.hostedUiUrl = this.domain.baseUrl()

		this.userPoolClient = new Cognito.UserPoolClient(this, 'userPoolClient', {
			userPool: this.userPool,
			generateSecret: false,
			authFlows: {
				userPassword: false,
				userSrp: false,
				custom: false,
				user: true,
				adminUserPassword: false,
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
			supportedIdentityProviders: [
				Cognito.UserPoolClientIdentityProvider.COGNITO,
			],
			accessTokenValidity: Duration.days(1),
			idTokenValidity: Duration.days(1),
			refreshTokenValidity: Duration.days(30),
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
			),
			inlinePolicies: {},
		})

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
				),
				inlinePolicies: {},
			},
		)

		new Cognito.CfnIdentityPoolRoleAttachment(this, 'identityPoolRoles', {
			identityPoolId: this.identityPool.ref.toString(),
			roles: {
				authenticated: this.authenticatedUserRole.roleArn,
				unauthenticated: this.unauthenticatedUserRole.roleArn,
			},
		})

		// Create Managed Login Branding
		new CfnManagedLoginBranding(this, 'ManagedLoginBranding', {
			userPoolId: this.userPool.userPoolId,
			clientId: this.userPoolClient.userPoolClientId,
			useCognitoProvidedValues: true,
		})
	}
}
