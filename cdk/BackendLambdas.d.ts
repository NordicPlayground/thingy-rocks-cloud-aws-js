import type { PackedLambda } from '@bifravst/aws-cdk-lambda-helpers'

type BackendLambdas = {
	publishToWebsocketClients: PackedLambda
	onConnect: PackedLambda
	onMessage: PackedLambda
	onDisconnect: PackedLambda
	onCellGeoLocationResolved: PackedLambda
	resolveCellLocation: PackedLambda
	publishSummaries: PackedLambda
	onNewNetworkSurvey: PackedLambda
	onNetworkSurveyLocated: PackedLambda
	updatesToLwM2M: PackedLambda
	lwm2mGateway: PackedLambda
	memfaultPublishReboots: PackedLambda
	memfaultPollForReboots: PackedLambda
	processUPDPackets: PackedLambda
	udpDatagramsLogs: PackedLambda
}
