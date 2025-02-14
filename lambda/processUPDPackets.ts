import { requestLogger } from '@hello.nrfcloud.com/lambda-helpers/requestLogger'
import middy from '@middy/core'

export const handler = middy()
	.use(requestLogger())
	.handler(async () => {})
