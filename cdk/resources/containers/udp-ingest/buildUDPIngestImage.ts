import { hashFolder } from '@bifravst/aws-cdk-ecr-helpers/hashFolder'
import {
	type ImageBuilder,
	type ImageChecker,
} from '@bifravst/aws-cdk-ecr-helpers/image'
import run from '@bifravst/run'
import path from 'node:path'
import { ContainerRepositoryId } from '../../../../aws/ecr.ts'

export const buildUDPIngestImage = async (
	builder: ImageBuilder,
	checker: ImageChecker,
	debug?: typeof console.debug,
	pull?: boolean,
): Promise<string> => {
	await run({
		command: 'go',
		args: ['build'],
		cwd: path.join(
			process.cwd(),
			'cdk',
			'resources',
			'containers',
			'udp-ingest',
			'server',
		),
		log: {
			debug,
		},
	})

	await run({
		command: 'go',
		args: ['build'],
		cwd: path.join(
			process.cwd(),
			'cdk',
			'resources',
			'containers',
			'udp-ingest',
			'health',
		),
		log: {
			debug,
		},
	})

	const dockerFilePath = path.join(
		process.cwd(),
		'cdk',
		'resources',
		'containers',
		'udp-ingest',
	)

	const tag = await hashFolder(dockerFilePath)

	if (
		await checker({
			tag,
			debug,
			pull,
		})
	)
		return tag

	await builder({
		id: ContainerRepositoryId.UDPIngest,
		tag,
		dockerFilePath,
		debug,
	})
	return tag
}
