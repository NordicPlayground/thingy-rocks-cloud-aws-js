import type { PackedLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import { App } from 'aws-cdk-lib'
import type { BackendLambdas } from './BackendLambdas.ts'
import { BackendStack } from './stacks/BackendStack.ts'

export class BackendApp extends App {
	public constructor({
		lambdaSources,
		layer,
		assetTrackerStackName,
	}: {
		lambdaSources: BackendLambdas
		layer: PackedLayer
		assetTrackerStackName: string
	}) {
		super({
			context: {
				version: Date.now().toString(),
				isTest: false,
			},
		})
		console.log(lambdaSources)
		new BackendStack(this, { lambdaSources, layer, assetTrackerStackName })
	}
}
