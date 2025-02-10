import { ECRClient } from '@aws-sdk/client-ecr'
import {
	buildAndPublishImage,
	checkIfImageExists,
} from '@bifravst/aws-cdk-ecr-helpers/image'
import { getOrCreateRepository } from '@bifravst/aws-cdk-ecr-helpers/repository'
import { ContainerRepositoryId } from './aws/ecr.ts'
import { buildCoAPEndpointImage } from './cdk/resources/containers/coap-endpoint/buildCoAPEndpointImage.ts'
import { STACK_NAME } from './cdk/stacks/stackName.ts'

// Build the container needed to run the backend.

const ecr = new ECRClient({})

const ensureRepo = getOrCreateRepository({ ecr })

const coAPEndpointRepo = await ensureRepo({
	stackName: STACK_NAME,
	id: ContainerRepositoryId.CoAPEndpoint,
	debug: console.debug,
})

const tag = await buildCoAPEndpointImage(
	buildAndPublishImage({
		ecr,
		repo: coAPEndpointRepo,
	}),
	checkIfImageExists({
		ecr,
		repo: coAPEndpointRepo,
	}),
	console.debug,
)

process.stdout.write(tag)
