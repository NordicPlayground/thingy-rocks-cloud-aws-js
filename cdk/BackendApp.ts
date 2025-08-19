import type { PackedLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import { App, type Environment } from 'aws-cdk-lib'
import type { BackendLambdas } from './BackendLambdas.ts'
import { BackendStack } from './stacks/BackendStack.ts'
import { NRPlusStack } from './stacks/NRPlusStack.ts'

export class BackendApp extends App {
	public constructor({
		lambdaSources,
		layer,
		assetTrackerStackName,
		env,
		version,
	}: {
		lambdaSources: BackendLambdas
		layer: PackedLayer
		assetTrackerStackName: string
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

		new NRPlusStack(this, {
			lambdaSources,
			layer,
		})
	}
}
