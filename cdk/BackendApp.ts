import type { PackedLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import { App, type Environment } from 'aws-cdk-lib'
import type { BackendLambdas } from './BackendLambdas.ts'
import { BackendStack } from './stacks/BackendStack.ts'
import { NRPlusStack } from './stacks/NRPlusStack.ts'
import { UDPIngestStack } from './stacks/UDPIngestStack.ts'

export class BackendApp extends App {
	public constructor({
		lambdaSources,
		layer,
		assetTrackerStackName,
		udpIngestContainerTag,
		env,
		version,
	}: {
		lambdaSources: BackendLambdas
		layer: PackedLayer
		assetTrackerStackName: string
		udpIngestContainerTag: string
		env: Required<Environment>
		version: string
	}) {
		super({
			context: {
				version,
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
			lambdaSources,
			layer,
		})

		new NRPlusStack(this, {
			lambdaSources,
			layer,
		})
	}
}
