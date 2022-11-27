import { App } from 'aws-cdk-lib'
import type { PackedLambda } from './packLambda.js'
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
		}
		layer: PackedLayer
		assetTrackerStackName: string
	}) {
		super()
		new BackendStack(this, { lambdaSources, layer, assetTrackerStackName })
	}
}
