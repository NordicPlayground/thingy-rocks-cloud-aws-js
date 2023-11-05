import { aws_iam as IAM, aws_location as Location, Stack } from 'aws-cdk-lib'
import type { CfnMap } from 'aws-cdk-lib/aws-location'
import { Construct } from 'constructs'
import type { UserAuthentication } from './UserAuthentication'

export class Map extends Construct {
	public readonly map: CfnMap

	constructor(
		parent: Construct,
		id: string,
		{
			userAuthentication,
		}: {
			userAuthentication: UserAuthentication
		},
	) {
		super(parent, id)

		this.map = new Location.CfnMap(this, 'mapDark', {
			mapName: `${Stack.of(parent).stackName}-map`,
			description:
				'Map used to display on the dashboard (Esri Dark Gray Canvas)',
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
