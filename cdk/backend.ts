import path from 'path'
import { BackendApp } from './BackendApp.js'
import { packLambda } from './packLambda.js'
import { packLayer } from './packLayer.js'

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
	},
	layer: await packLayer({
		id: 'baseLayer',
		dependencies: packagesInLayer,
	}),
})
