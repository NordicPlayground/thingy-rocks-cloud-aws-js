import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { BackendApp } from './BackendApp.js'
import { packLambda } from './packLambda.js'
import { packLayer } from './packLayer.js'
import { ASSET_TRACKER_STACK_NAME } from './stacks/stackName.js'
export type PackedLambda = { lambdaZipFile: string; handler: string }

const packagesInLayer: string[] = [
	'@nordicsemiconductor/from-env',
	'@sinclair/typebox',
	'ajv',
	'@nordicsemiconductor/timestream-helpers',
]
const pack = async (
	id: string,
	handlerFunction = 'handler',
): Promise<PackedLambda> => {
	try {
		await mkdir(path.join(process.cwd(), 'dist', 'lambdas'), {
			recursive: true,
		})
	} catch {
		// Directory exists
	}
	const zipFile = path.join(process.cwd(), 'dist', 'lambdas', `${id}.zip`)
	const { handler } = await packLambda({
		sourceFile: path.join(process.cwd(), 'lambda', `${id}.ts`),
		zipFile,
	})
	return {
		lambdaZipFile: zipFile,
		handler: handler.replace('.js', `.${handlerFunction}`),
	}
}

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
	},
	layer: await packLayer({
		id: 'baseLayer',
		dependencies: packagesInLayer,
	}),
	assetTrackerStackName: ASSET_TRACKER_STACK_NAME,
})
