import type { PackedLambda } from './backend'

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
	parseSinkMessages: PackedLambda
	updatesToLwM2M: PackedLambda
	publishLwM2MShadowsToJSON: PackedLambda
	memfault: PackedLambda
	memfaultPollForReboots: PackedLambda
}
