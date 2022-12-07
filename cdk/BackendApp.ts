import { App } from 'aws-cdk-lib'
import type { PackedLambda } from './backend.js'
import type { PackedLayer } from './packLayer.js'
import { BackendStack } from './stacks/BackendStack.js'

export class BackendApp extends App {
	public constructor({
		lambdaSources,
		layer,
		assetTrackerStackName,
	}: {
		lambdaSources: {
			publishToWebsocketClients: PackedLambda
			onConnect: PackedLambda
			onMessage: PackedLambda
			onDisconnect: PackedLambda
			onCellGeoLocationResolved: PackedLambda
			resolveCellLocation: PackedLambda
			publishSummaries: PackedLambda
		}
		layer: PackedLayer
		assetTrackerStackName: string
	}) {
		super()
		new BackendStack(this, { lambdaSources, layer, assetTrackerStackName })
	}
}
