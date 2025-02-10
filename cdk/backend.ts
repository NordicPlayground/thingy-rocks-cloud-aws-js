import { STS } from '@aws-sdk/client-sts'
import { packLambdaFromPath } from '@bifravst/aws-cdk-lambda-helpers'
import { packLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { env } from '../aws/env.ts'
import pJson from '../package.json' assert { type: 'json' }
import { BackendApp } from './BackendApp.ts'
import { ASSET_TRACKER_STACK_NAME } from './stacks/stackName.ts'

const sts = new STS({})

const packagesInLayer: Array<keyof (typeof pJson)['dependencies']> = [
	'@nordicsemiconductor/from-env',
	'@sinclair/typebox',
	'ajv',
	'@nordicsemiconductor/timestream-helpers',
	'@hello.nrfcloud.com/proto-map',
	'jsonata',
	'p-retry',
	'@middy/core',
	'@middy/input-output-logger',
	'@hello.nrfcloud.com/lambda-helpers',
]
const pack = async (id: string) =>
	packLambdaFromPath({ id, sourceFilePath: `lambda/${id}.ts` })

// Ensure needed container images exist
const { coAPEndpointContainerTag } = fromEnv({
	coAPEndpointContainerTag: 'COAP_ENDPOINT_CONTAINER_TAG',
})(process.env)

const accountEnv = await env({ sts })

new BackendApp({
	lambdaSources: {
		publishToWebsocketClients: await pack('publishToWebsocketClients'),
		onConnect: await pack('onConnect'),
		onMessage: await pack('onMessage'),
		onDisconnect: await pack('onDisconnect'),
		onCellGeoLocationResolved: await pack('onCellGeoLocationResolved'),
		resolveCellLocation: await pack('resolveCellLocation'),
		publishSummaries: await pack('publishSummaries'),
		onNewNetworkSurvey: await pack('onNewNetworkSurvey'),
		onNetworkSurveyLocated: await pack('onNetworkSurveyLocated'),
		updatesToLwM2M: await pack('updatesToLwM2M'),
		lwm2mGateway: await pack('lwm2mGateway'),
		memfaultPublishReboots: await pack('memfaultPublishReboots'),
		memfaultPollForReboots: await pack('memfaultPollForReboots'),
	},
	layer: await packLayer({
		id: 'baseLayer',
		dependencies: packagesInLayer,
	}),
	assetTrackerStackName: ASSET_TRACKER_STACK_NAME,
	coAPEndpointContainerTag,
	// Needed for VPC
	env: accountEnv,
})
