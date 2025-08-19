import { STS } from '@aws-sdk/client-sts'
import { packLambdaFromPath } from '@bifravst/aws-cdk-lambda-helpers'
import { packLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import { env } from '../aws/env.ts'
import pJson from '../package.json' with { type: 'json' }
import { BackendApp } from './BackendApp.ts'
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
]
const pack = async (id: string) =>
	packLambdaFromPath({ id, sourceFilePath: `lambda/${id}.ts` })

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
		parseSinkMessages: await pack('parseSinkMessages'),
		updatesToLwM2M: await pack('updatesToLwM2M'),
		lwm2mGateway: await pack('lwm2mGateway'),
		memfaultPublishReboots: await pack('memfaultPublishReboots'),
		memfaultPollForReboots: await pack('memfaultPollForReboots'),
		storeObjectsInTimestream: await pack('storeObjectsInTimestream'),
	},
	layer: await packLayer({
		id: 'baseLayer',
		dependencies: packagesInLayer,
	}),
	assetTrackerStackName: ASSET_TRACKER_STACK_NAME,
	// Needed for VPC
	env: accountEnv,
	version: process.env.VERSION ?? '0.0.0',
})
