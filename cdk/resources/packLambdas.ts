import {
	packLambdaFromPath,
	type PackedLambda,
} from '@bifravst/aws-cdk-lambda-helpers'

const pack = async (id: string) =>
	packLambdaFromPath({ id, sourceFilePath: `lambda/${id}.ts` })

type Lambdas = {
	publishToWebsocketClients: PackedLambda
	onConnect: PackedLambda
	onMessage: PackedLambda
	onDisconnect: PackedLambda
	onCellGeoLocationResolved: PackedLambda
	resolveCellLocation: PackedLambda
	resolveCellLocationFromLwM2M: PackedLambda
	publishSummaries: PackedLambda
	onNewNetworkSurvey: PackedLambda
	onNetworkSurveyLocated: PackedLambda
	parseSinkMessages: PackedLambda
	updatesToLwM2M: PackedLambda
	lwm2mGateway: PackedLambda
	memfaultPublishReboots: PackedLambda
	memfaultPollForReboots: PackedLambda
	processUPDPackets: PackedLambda
	udpDatagramsLogs: PackedLambda
	storeObjectsInTimestream: PackedLambda
	webhookHandler: PackedLambda
}

export const packLambdas = async (): Promise<Lambdas> => ({
	publishToWebsocketClients: await pack('publishToWebsocketClients'),
	onConnect: await pack('onConnect'),
	onMessage: await pack('onMessage'),
	onDisconnect: await pack('onDisconnect'),
	onCellGeoLocationResolved: await pack('onCellGeoLocationResolved'),
	resolveCellLocation: await pack('resolveCellLocation'),
	resolveCellLocationFromLwM2M: await pack('resolveCellLocationFromLwM2M'),
	publishSummaries: await pack('publishSummaries'),
	onNewNetworkSurvey: await pack('onNewNetworkSurvey'),
	onNetworkSurveyLocated: await pack('onNetworkSurveyLocated'),
	parseSinkMessages: await pack('parseSinkMessages'),
	updatesToLwM2M: await pack('updatesToLwM2M'),
	lwm2mGateway: await pack('lwm2mGateway'),
	memfaultPublishReboots: await pack('memfaultPublishReboots'),
	memfaultPollForReboots: await pack('memfaultPollForReboots'),
	processUPDPackets: await pack('processUPDPackets'),
	udpDatagramsLogs: await pack('udpDatagramsLogs'),
	storeObjectsInTimestream: await pack('storeObjectsInTimestream'),
	webhookHandler: await pack('webhookHandler'),
})
