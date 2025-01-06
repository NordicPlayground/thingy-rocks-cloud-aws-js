import { BackendApp } from './BackendApp.js'
import { ASSET_TRACKER_STACK_NAME } from './stacks/stackName.js'
import { packLambdaFromPath } from '@bifravst/aws-cdk-lambda-helpers'
import { packLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'

const packagesInLayer: string[] = [
	'@nordicsemiconductor/from-env',
	'@sinclair/typebox',
	'ajv',
	'@nordicsemiconductor/timestream-helpers',
	'@hello.nrfcloud.com/proto-map',
	'jsonata',
	'mqtt',
	'@protobuf-ts/runtime',
	'p-retry',
]
const pack = async (id: string) => packLambdaFromPath(id, `lambda/${id}.ts`)

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
		memfaultPublishReboots: await pack('memfaultPublishReboots'),
		memfaultPollForReboots: await pack('memfaultPollForReboots'),
	},
	layer: await packLayer({
		id: 'baseLayer',
		dependencies: packagesInLayer,
	}),
	assetTrackerStackName: ASSET_TRACKER_STACK_NAME,
})
