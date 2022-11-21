import { spawn } from 'child_process'
import esbuild from 'esbuild'
import { mkdir, rm, symlink, writeFile } from 'fs/promises'
import path from 'path'
import { listLambdaDependencies } from './listLambdaDependencies.js'
export type PackedLambda = { lambdaZipFile: string; handler: string }

/**
 * AWS Lambda does not yet support layers when using ESM.
 * @see https://github.com/NordicSemiconductor/asset-tracker-cloud-aws-js/issues/572
 *
 * However, symlinking the node_modules folder from the layer solves the problem.
 * @see https://github.com/vibe/aws-esm-modules-layer-support
 *
 * In the bundle we only include code that's not in the layer.
 *
 * We need to use the `zip` binary here, instead of `yazl` to include a symlink, because `yazl` does not support symlinks, yet.
 * @see https://github.com/thejoshwolfe/yazl/pull/34
 */
export const packLambda = async ({
	id,
	baseDir,
	handler,
}: {
	id: string
	baseDir: string
	handler?: string
}): Promise<PackedLambda> => {
	const lambdaFiles = listLambdaDependencies(path.join(baseDir, `${id}.ts`))

	const compiled = await Promise.all(
		lambdaFiles.map(async (f) => ({
			file: f.replace(`${baseDir}${path.sep}`, '').replace(/\.ts$/, '.js'),
			transformed: await (async (entry) => {
				const { outputFiles } = await esbuild.build({
					entryPoints: [entry],
					write: false,
					target: 'node14',
					format: 'esm',
				})
				return outputFiles[0]?.text
			})(f),
		})),
	)

	const lambdaDir = path.join(process.cwd(), 'dist', 'lambdas', id)

	try {
		await rm(lambdaDir, { recursive: true })
	} catch {
		// dir does not exist
	}

	await mkdir(lambdaDir, { recursive: true })
	await symlink(
		'/opt/nodejs/node_modules',
		path.join(lambdaDir, 'node_modules'),
		'dir',
	)

	// Write bundled lambda code
	await Promise.all(
		compiled.map(async ({ file, transformed }) =>
			writeFile(path.join(lambdaDir, file), transformed ?? '', 'utf-8'),
		),
	)

	// Mark it as ES module
	await writeFile(
		path.join(lambdaDir, 'package.json'),
		JSON.stringify({
			type: 'module',
		}),
		'utf-8',
	)

	const zipFileName = path.join(process.cwd(), 'dist', 'lambdas', `${id}.zip`)
	await new Promise<void>((resolve, reject) => {
		const p = spawn('zip', ['--symlinks', '-r', zipFileName, `.`], {
			cwd: lambdaDir,
		})
		const errorOut: string[] = []
		p.on('close', (code) => {
			if (code !== 0) {
				return reject(new Error(`ZIP failed! ${errorOut.join('')}`))
			}
			return resolve()
		})
		p.stderr.on('data', (data) => {
			errorOut.push(data)
		})
	})

	return {
		lambdaZipFile: zipFileName,
		handler: `${id}.${handler ?? 'handler'}`,
	}
}
