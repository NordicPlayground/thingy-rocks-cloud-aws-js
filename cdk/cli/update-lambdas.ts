import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { LambdaClient } from '@aws-sdk/client-lambda'
import type { PackedLambda } from '@bifravst/aws-cdk-lambda-helpers'
import { updateLambdaCode } from '@bifravst/aws-cdk-lambda-helpers/util'
import chalk from 'chalk'
import { packLambdas } from '../resources/packLambdas.ts'
import {
	NRPLUS_DEMO_STACK_NAME,
	NRPLUS_STACK_NAME,
	STACK_NAME,
	UDP_INGEST_STACK_NAME,
} from '../stacks/stackName.ts'

const cf = new CloudFormationClient()
const lambda = new LambdaClient()
const update = updateLambdaCode({ cf, lambda })

const start = new Date()
const lambdas = await packLambdas()
console.debug('Packed lambdas in', new Date().getTime() - start.getTime(), 'ms')

const stackLambdas: Array<[string, Record<string, PackedLambda>]> = [
	[STACK_NAME, lambdas],
	[UDP_INGEST_STACK_NAME, lambdas],
	[NRPLUS_STACK_NAME, lambdas],
	[NRPLUS_DEMO_STACK_NAME, lambdas],
]

await Promise.all(
	stackLambdas.map(async ([stackName, lambdas]) =>
		update(stackName, lambdas, (arg, ...args) =>
			console.debug(chalk.blue(`[${stackName}]`), chalk.green(arg), ...args),
		),
	),
)

console.debug('Done')

console.debug(
	'Updated lambdas in',
	new Date().getTime() - start.getTime(),
	'ms',
)
