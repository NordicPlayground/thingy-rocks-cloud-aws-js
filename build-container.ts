import { ECRClient } from '@aws-sdk/client-ecr'
import {
	buildAndPublishImage,
	checkIfImageExists,
} from '@bifravst/aws-cdk-ecr-helpers/image'
import { getOrCreateRepository } from '@bifravst/aws-cdk-ecr-helpers/repository'
import { ContainerRepositoryId } from './aws/ecr.ts'
import { buildUDPIngestImage } from './cdk/resources/containers/udp-ingest/buildUDPIngestImage.ts'
import { UDP_INGEST_STACK_NAME } from './cdk/stacks/stackName.ts'

// Build the container needed to run the backend.

const ecr = new ECRClient({})

const ensureRepo = getOrCreateRepository({ ecr })

const UDPIngestRepo = await ensureRepo({
	stackName: UDP_INGEST_STACK_NAME,
	id: ContainerRepositoryId.UDPIngest,
	debug: console.error,
})

const tag = await buildUDPIngestImage(
	buildAndPublishImage({
		ecr,
		repo: UDPIngestRepo,
	}),
	checkIfImageExists({
		ecr,
		repo: UDPIngestRepo,
	}),
	console.error,
)

process.stdout.write(`export UDP_INGEST_CONTAINER_TAG=${tag}\n`)
