import type { App } from 'aws-cdk-lib'
import { Stack } from 'aws-cdk-lib'
import type { BackendLambdas } from '../BackendLambdas.ts'
import { NRPlusGateway } from '../resources/NRPlusGateway.ts'
import { NRPLUS_STACK_NAME } from './stackName.ts'

export class NRPlusStack extends Stack {
	public constructor(
		parent: App,
		{
			lambdaSources,
		}: {
			lambdaSources: BackendLambdas
		},
	) {
		super(parent, NRPLUS_STACK_NAME)

		new NRPlusGateway(this, {
			lambdaSources,
		})
	}
}
