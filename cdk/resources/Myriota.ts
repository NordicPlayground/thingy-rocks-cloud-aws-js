import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import { Duration, aws_iam as IAM, aws_lambda as Lambda } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../BackendLambdas.ts'

/**
 * Receives messages from the Myriota Device Manager
 *
 * @see https://support.myriota.com/hc/en-us/articles/6482340814351-HTTP
 */
export class Myriota extends Construct {
	public readonly webhookURL: string
	public constructor(
		parent: Construct,
		{
			lambdaSources,
			baseLayer,
		}: {
			lambdaSources: Pick<BackendLambdas, 'myriotaWebhook'>
			baseLayer: Lambda.ILayerVersion
		},
	) {
		super(parent, 'Myriota')

		const webhook = new PackedLambdaFn(
			this,
			'webhook',
			lambdaSources.myriotaWebhook,
			{
				description: 'Receives messages from the Myriota Device Manager',
				layers: [baseLayer],
				timeout: Duration.seconds(10),
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['iot:ListThings', 'iot:UpdateThingShadow'],
						resources: ['*'],
					}),
				],
			},
		)

		// Requests are authenticated by verifying the signature in the payload
		this.webhookURL = webhook.fn.addFunctionUrl({
			authType: Lambda.FunctionUrlAuthType.NONE,
		}).url
	}
}
