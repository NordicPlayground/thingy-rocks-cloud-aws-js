import { aws_iam as IAM, aws_location as Location, Stack } from 'aws-cdk-lib'
import type { CfnMap } from 'aws-cdk-lib/aws-location'
import { Construct } from 'constructs'
import type { UserAuthentication } from './UserAuthentication'

export class Map extends Construct {
	public readonly map: CfnMap

	constructor(
		parent: Stack,
		id: string,
		{
			userAuthentication,
		}: {
			userAuthentication: UserAuthentication
		},
	) {
		super(parent, id)

		this.map = new Location.CfnMap(this, 'map', {
			mapName: 'thingy-rocks',
			description: 'Map used to display on the dashboard',
			configuration: {
				style: 'VectorEsriDarkGrayCanvas',
			},
		})

		userAuthentication.unauthenticatedUserRole.addToPrincipalPolicy(
			new IAM.PolicyStatement({
				actions: ['geo:GetMap*'],
				resources: [this.map.attrArn],
				conditions: {
					StringLike: {
						'aws:referer': [
							'https://world.thingy.rocks/*',
							'http://localhost:*/*',
						],
					},
				},
			}),
		)
	}
}
