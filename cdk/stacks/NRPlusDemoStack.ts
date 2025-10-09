import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import type { PackedLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import CloudFormation, {
	type App,
	CfnOutput,
	aws_iam as IAM,
	aws_lambda as Lambda,
	Stack,
} from 'aws-cdk-lib'
import type { BackendLambdas } from '../BackendLambdas.ts'
import { NRPLUS_DEMO_STACK_NAME } from './stackName.ts'

export class NRPlusDemoStack extends Stack {
	public constructor(
		parent: App,
		{
			lambdaSources,
			layer,
		}: {
			lambdaSources: BackendLambdas
			layer: PackedLayer
		},
	) {
		super(parent, NRPLUS_DEMO_STACK_NAME)

		const baseLayer = new Lambda.LayerVersion(this, 'baseLayer', {
			layerVersionName: `${Stack.of(this).stackName}-baseLayer`,
			code: Lambda.Code.fromAsset(layer.layerZipFilePath),
			compatibleArchitectures: [Lambda.Architecture.ARM_64],
			compatibleRuntimes: [Lambda.Runtime.NODEJS_22_X],
		})

		const webhookHandler = new PackedLambdaFn(
			this,
			'webhookHandler',
			lambdaSources.webhookHandler,
			{
				runtime: Lambda.Runtime.NODEJS_22_X,
				description:
					'Webhook handler for LwM2M messages coming from nRF Cloud MRS',
				layers: [baseLayer],
				timeout: CloudFormation.Duration.seconds(60),
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: [
							'iot:UpdateThingShadow',
							'iot:DescribeThing',
							'iot:CreateThing',
						],
						resources: [
							`arn:aws:iot:${Stack.of(this).region}:${Stack.of(this).account}:thing/*/shadow/lwm2m`,
						],
					}),
				],
			},
		)

		const functionUrl = webhookHandler.fn.addFunctionUrl({
			authType: Lambda.FunctionUrlAuthType.NONE,
		})

		new CfnOutput(this, 'WebhookFunctionURL', {
			exportName: 'WebhookFunctionURL',
			description: 'The URL for the webhook function',
			value: functionUrl.url,
		})
	}
}
