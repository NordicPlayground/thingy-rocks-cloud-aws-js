import { Fn, Stack, type App } from 'aws-cdk-lib'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { Effect, Policy, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam'
import { STACK_NAME, VIDEO_INTEGRATION_STACK_NAME } from './stackName.ts'

export class VideoIntegrationStack extends Stack {
	public constructor(parent: App) {
		super(parent, VIDEO_INTEGRATION_STACK_NAME, {
			description: 'Integrate with video.thingy.rocks',
		})

		const authRole = Role.fromRoleArn(
			this,
			'authRole',
			Fn.importValue(`${STACK_NAME}:authenticatedUserRoleArn`),
		)

		const unauthRole = Role.fromRoleArn(
			this,
			'unauthRole',
			Fn.importValue(`${STACK_NAME}:unauthenticatedUserRoleArn`),
		)

		// Grant GetDataEndpoint to web user roles (for viewer clients to get playback endpoint)
		new Policy(this, 'WebRolesPolicy', {
			statements: [
				new PolicyStatement({
					effect: Effect.ALLOW,
					actions: [
						'kinesisvideo:GetDataEndpoint',
						'kinesisvideo:DescribeStream',
						'kinesisvideo:GetDASHStreamingSessionURL',
						'kinesisvideo:GetDataEndpoint',
						'kinesisvideo:GetHLSStreamingSessionURL',
						'kinesisvideo:GetImages',
					],
					resources: [`arn:aws:kinesisvideo:*:${this.account}:stream/*`],
				}),
				new PolicyStatement({
					effect: Effect.ALLOW,
					actions: ['kinesisvideo:ListStreams'],
					resources: [`*`],
				}),
			],
			roles: [authRole],
		})

		// Grant read access to video stream metadata table for web user roles (for viewer clients to get stream metadata)
		const videoStreamMetaDataTable = Table.fromTableArn(
			this,
			'VideoStreamMetaDataTable',
			Fn.importValue(`video-streaming:StreamMetadataTableArn`),
		)
		videoStreamMetaDataTable.grantReadData(authRole)
		videoStreamMetaDataTable.grantReadData(unauthRole)
	}
}
