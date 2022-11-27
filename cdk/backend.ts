import path from 'path'
import { BackendApp } from './BackendApp.js'
import { packLambda } from './packLambda.js'
import { packLayer } from './packLayer.js'
import { ASSET_TRACKER_STACK_NAME } from './stacks/stackName.js'

const baseDir = path.join(process.cwd(), 'lambda')
const packagesInLayer: string[] = [
	'@aws-sdk/client-apigatewaymanagementapi',
	'@nordicsemiconductor/from-env',
]
const pack = async (id: string) =>
	packLambda({
		id,
		baseDir,
	})

new BackendApp({
	lambdaSources: {
		publishToWebsocketClients: await pack('publishToWebsocketClients'),
		onConnect: await pack('onConnect'),
		onMessage: await pack('onMessage'),
		onDisconnect: await pack('onDisconnect'),
		onCellGeoLocationResolved: await pack('onCellGeoLocationResolved'),
	},
	layer: await packLayer({
		id: 'baseLayer',
		dependencies: packagesInLayer,
	}),
	assetTrackerStackName: ASSET_TRACKER_STACK_NAME,
})
