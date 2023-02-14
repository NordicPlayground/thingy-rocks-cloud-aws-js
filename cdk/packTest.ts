import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { packLambda } from './packLambda.js'
export type PackedLambda = { lambdaZipFile: string; handler: string }

const pack = async (id: string, handler = 'handler'): Promise<PackedLambda> => {
	try {
		await mkdir(path.join(process.cwd(), 'dist', 'lambdas'), {
			recursive: true,
		})
	} catch {
		// Directory exists
	}
	const zipFile = path.join(process.cwd(), 'dist', 'lambdas', `${id}.zip`)
	await packLambda({
		sourceFile: path.join(process.cwd(), 'lambda', `${id}.ts`),
		zipFile,
		progress: (...args: any[]) => console.debug(`[pack]`, id, ...args),
	})
	return {
		lambdaZipFile: zipFile,
		handler: `${id}.${handler}`,
	}
}

await pack('onMessage')
await pack('publishToWebsocketClients')
await pack('onConnect')
await pack('onDisconnect')
await pack('onCellGeoLocationResolved')
await pack('resolveCellLocation')
await pack('publishSummaries')
await pack('onNewNcellmeasReport')
await pack('onNcellmeasReportResolved')
await pack('onNewWiFiSiteSurveyReport')
await pack('lightbulbPing')
