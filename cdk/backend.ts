import { STS } from '@aws-sdk/client-sts'
import { packLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import { fromEnv } from '@bifravst/from-env'
import { env } from '../aws/env.ts'
import pJson from '../package.json' with { type: 'json' }
import { BackendApp } from './BackendApp.ts'
import { packLambdas } from './resources/packLambdas.ts'
import { ASSET_TRACKER_STACK_NAME } from './stacks/stackName.ts'

const sts = new STS({})

const packagesInLayer: Array<keyof (typeof pJson)['dependencies']> = [
	'@bifravst/from-env',
	'@sinclair/typebox',
	'ajv',
	'@bifravst/timestream-helpers',
	'@hello.nrfcloud.com/proto-map',
	'jsonata',
	'p-retry',
	'@middy/core',
	'@middy/input-output-logger',
	'@hello.nrfcloud.com/lambda-helpers',
	'ulidx',
	'@bifravst/from-env',
	'cbor',
]

// Ensure needed container images exist
const { udpIngestContainerTag } = fromEnv({
	udpIngestContainerTag: 'UDP_INGEST_CONTAINER_TAG',
})(process.env)

const accountEnv = await env({ sts })

new BackendApp({
	lambdaSources: await packLambdas(),
	layer: await packLayer({
		id: 'baseLayer',
		dependencies: packagesInLayer,
	}),
	assetTrackerStackName: ASSET_TRACKER_STACK_NAME,
	udpIngestContainerTag,
	// Needed for VPC
	env: accountEnv,
	version: process.env.VERSION ?? '0.0.0',
})
