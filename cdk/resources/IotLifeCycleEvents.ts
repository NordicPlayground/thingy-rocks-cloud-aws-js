import {
	aws_iam as IAM,
	aws_iot as IoT,
	aws_logs as Logs,
	RemovalPolicy,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'

/**
 * Create a CloudWatch Log Group and IoT Topic Rules to log IoT lifecycle events
 *
 * @see https://docs.aws.amazon.com/iot/latest/developerguide/life-cycle-events.html
 */
export class IotLifeCycleEvents extends Construct {
	public readonly logGroup: Logs.ILogGroup

	constructor(scope: Construct) {
		super(scope, IotLifeCycleEvents.name)

		this.logGroup = new Logs.LogGroup(this, 'logGroup', {
			retention: Logs.RetentionDays.ONE_DAY,
			logGroupName: `/${Stack.of(this).stackName}/iot-lifecycle-events`,
			removalPolicy: RemovalPolicy.DESTROY,
		})

		const ruleRole = new IAM.Role(this, 'ruleRole', {
			assumedBy: new IAM.ServicePrincipal('iot.amazonaws.com'),
		})

		this.logGroup.grantWrite(ruleRole)

		for (const event of ['disconnected', 'connect_failed']) {
			new IoT.CfnTopicRule(this, `${event}Rule`, {
				topicRulePayload: {
					description: `Log IoT ${event} lifecycle event to CloudWatch`,
					ruleDisabled: false,
					awsIotSqlVersion: '2016-03-23',
					sql: [
						`SELECT * as event`,
						`FROM '$aws/events/presence/${event}/+'`,
					].join(' '),
					actions: [
						{
							cloudwatchLogs: {
								logGroupName: this.logGroup.logGroupName,
								roleArn: ruleRole.roleArn,
							},
						},
					],
				},
			})
		}
	}
}
