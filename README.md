# thingy.rocks IoT dashboard backend

[![GitHub Actions](https://github.com/NordicPlayground/thingy-rocks-cloud-aws-js/workflows/Test%20and%20Release/badge.svg)](https://github.com/NordicPlayground/thingy-rocks-cloud-aws-js/actions)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)
[![Mergify Status](https://img.shields.io/endpoint.svg?url=https://gh.mergify.io/badges/NordicPlayground/thingy-rocks-cloud-aws-js)](https://mergify.io)
[![@commitlint/config-conventional](https://img.shields.io/badge/%40commitlint-config--conventional-brightgreen)](https://github.com/conventional-changelog/commitlint/tree/master/@commitlint/config-conventional)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier/)
[![ESLint: TypeScript](https://img.shields.io/badge/ESLint-TypeScript-blue.svg)](https://github.com/typescript-eslint/typescript-eslint)

Cloud backend for the thingy.rocks IoT dashboard developed using AWS CDK in
[TypeScript](https://www.typescriptlang.org/).

## Installation in your AWS account

### Setup

Provide your AWS credentials, for example using the `.envrc` (see
[the example](./envrc.example)).

Install the dependencies:

```bash
npm ci
```

### Configure

Set the Wirepas 5G Mesh Gateway endpoint:

```bash
aws ssm put-parameter --name thingy-rocks-backend-Wirepas5GMeshGatewayEndpoint --type String --value $GATEWAY_MQTT_ENDPOINT
```

### Deploy

```bash
npx cdk deploy
```

## Support for managing Wirepas 5G Mesh nodes

For interacting with these nodes,

1. Create a thing type `mesh-node` (they cannot be created using
   CloudFormation).
1. Assign the thing type `mesh-node` to the thing which should act as a 5G Mesh
   Node.

The thing type is check when an state update is received from the UI.

### Running the Wirepas 5G Mesh Gateway

Configure the gateway settings using the `.envrc` (see
[the example](./envrc.example)).

Run:

```bash
npx tsx wirepas-5g-mesh-gateway/gateway.ts
```

Run as a service using systemd:

```bash
systemd-run -E GATEWAY_MQTT_ENDPOINT=${GATEWAY_MQTT_ENDPOINT} -E GATEWAY_AWS_ACCESS_KEY_ID=${GATEWAY_AWS_ACCESS_KEY_ID} -E GATEWAY_REGION=${GATEWAY_REGION} -E GATEWAY_AWS_SECRET_ACCESS_KEY=${GATEWAY_AWS_SECRET_ACCESS_KEY} --working-directory ${PWD} npx tsx wirepas-5g-mesh-gateway/gateway.ts
```
