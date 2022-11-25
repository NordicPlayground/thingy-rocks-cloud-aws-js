import { App } from 'aws-cdk-lib'
import type { PackedLambda } from './packLambda.js'
import type { PackedLayer } from './packLayer.js'
import { BackendStack } from './stacks/BackendStack.js'

export class BackendApp extends App {
	public constructor({
		lambdaSources,
		layer,
	}: {
		lambdaSources: {
			publishToWebsocketClients: PackedLambda
			onConnect: PackedLambda
			onMessage: PackedLambda
			onDisconnect: PackedLambda
		}
		layer: PackedLayer
	}) {
		super()
		new BackendStack(this, { lambdaSources, layer })
	}
}
