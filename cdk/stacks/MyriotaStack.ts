import type { PackedLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import { type App, CfnOutput, aws_lambda as Lambda, Stack } from 'aws-cdk-lib'
import type { BackendLambdas } from '../BackendLambdas.ts'
import { Myriota } from '../resources/Myriota.ts'
import { MYRIOTA_STACK_NAME } from './stackName.ts'

export class MyriotaStack extends Stack {
	public constructor(
		parent: App,
		{
			lambdaSources,
			layer,
		}: {
			lambdaSources: BackendLambdas
			layer: PackedLayer
		},
	) {
		super(parent, MYRIOTA_STACK_NAME)

		const baseLayer = new Lambda.LayerVersion(this, 'baseLayer', {
			layerVersionName: `${Stack.of(this).stackName}-baseLayer`,
			code: Lambda.Code.fromAsset(layer.layerZipFilePath),
			compatibleArchitectures: [Lambda.Architecture.ARM_64],
			compatibleRuntimes: [Lambda.Runtime.NODEJS_24_X],
		})

		const myriota = new Myriota(this, {
			lambdaSources,
			baseLayer,
		})

		new CfnOutput(this, 'webhookURL', {
			value: myriota.webhookURL,
			exportName: `${this.stackName}:webhookURL`,
			description:
				'The URL to configure as HTTP destination in the Myriota Device Manager',
		})
	}
}
