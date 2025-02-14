import type { PackedLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import { App, type Environment } from 'aws-cdk-lib'
import type { BackendLambdas } from './BackendLambdas.ts'
import { BackendStack } from './stacks/BackendStack.ts'
import { UDPIngestStack } from './stacks/UDPIngestStack.ts'

export class BackendApp extends App {
	public constructor({
		lambdaSources,
		layer,
		assetTrackerStackName,
		udpIngestContainerTag,
		env,
	}: {
		lambdaSources: BackendLambdas
		layer: PackedLayer
		assetTrackerStackName: string
		udpIngestContainerTag: string
		env: Required<Environment>
	}) {
		super({
			context: {
				version: Date.now().toString(),
				isTest: false,
			},
		})
		new BackendStack(this, {
			lambdaSources,
			layer,
			assetTrackerStackName,
		})

		new UDPIngestStack(this, {
			udpIngestContainerTag,
			env,
		})
	}
}
