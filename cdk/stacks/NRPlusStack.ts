import type { PackedLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import type { App } from 'aws-cdk-lib'
import { aws_lambda as Lambda, Stack } from 'aws-cdk-lib'
import type { BackendLambdas } from '../BackendLambdas.ts'
import { NRPlusGateway } from '../resources/NRPlusGateway.ts'
import { NRPLUS_STACK_NAME } from './stackName.ts'

export class NRPlusStack extends Stack {
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
		super(parent, NRPLUS_STACK_NAME)

		const baseLayer = new Lambda.LayerVersion(this, 'baseLayer', {
			layerVersionName: `${Stack.of(this).stackName}-baseLayer`,
			code: Lambda.Code.fromAsset(layer.layerZipFilePath),
			compatibleArchitectures: [Lambda.Architecture.ARM_64],
			compatibleRuntimes: [Lambda.Runtime.NODEJS_24_X],
		})

		new NRPlusGateway(this, {
			lambdaSources,
			layer: baseLayer,
		})
	}
}
