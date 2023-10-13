import swc from '@swc/core'
import { createWriteStream } from 'node:fs'
import { parse } from 'path'
import * as yazl from 'yazl'
import { commonParent } from './commonParent'
import { findDependencies } from './findDependencies'

/**
 * In the bundle we only include code that's not in the layer.
 */
export const packLambda = async ({
	sourceFile,
	zipFile,
	debug,
	progress,
}: {
	sourceFile: string
	zipFile: string
	debug?: (label: string, info: string) => void
	progress?: (label: string, info: string) => void
}): Promise<void> => {
	const lambdaFiles = [sourceFile, ...findDependencies(sourceFile)]

	const zipfile = new yazl.ZipFile()

	const parentDir = commonParent(lambdaFiles)

	for (const file of lambdaFiles) {
		const compiled = (
			await swc.transformFile(file, {
				jsc: {
					target: 'es2022',
				},
			})
		).code
		debug?.(`compiled`, compiled)
		const p = parse(file)
		const jsFileName = [
			p.dir.replace(parentDir.slice(0, parentDir.length - 1), ''),
			`${p.name}.js`,
		]
			.join('/')
			// Replace leading slash
			.replace(/^\//, '')

		zipfile.addBuffer(Buffer.from(compiled, 'utf-8'), jsFileName)
		progress?.(`added`, jsFileName)
	}

	// Mark it as ES module
	zipfile.addBuffer(
		Buffer.from(
			JSON.stringify({
				type: 'module',
			}),
			'utf-8',
		),
		'package.json',
	)
	progress?.(`added`, 'package.json')

	await new Promise<void>((resolve) => {
		zipfile.outputStream.pipe(createWriteStream(zipFile)).on('close', () => {
			resolve()
		})
		zipfile.end()
	})
	progress?.(`written`, zipFile)
}