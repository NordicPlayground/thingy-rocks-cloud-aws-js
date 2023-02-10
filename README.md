# thingy.rocks IoT dashboard backend

[![GitHub Actions](https://github.com/NordicPlayground/thingy-rocks-cloud-aws-js/workflows/Test%20and%20Release/badge.svg)](https://github.com/NordicPlayground/thingy-rocks-cloud-aws-js/actions)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)
[![Mergify Status](https://img.shields.io/endpoint.svg?url=https://gh.mergify.io/badges/NordicPlayground/thingy-rocks-cloud-aws-js)](https://mergify.io)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
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

### Deploy

```bash
npx cdk deploy
```

## Support for the MQTT Sample

Because the sample is not using the shadow, some manual work is needed to make
it work:

1. Create a thing type `rgb-light` (they cannot be created using
   CloudFormation).
1. Assign the thing type `rgb-light` to the thing which should act as a light
   bulb.

## Authentication

For changing the state of light bulbs and 5G Mesh Nodes, create a Thing
attribute named `code` and provide a secret there. This is compared to the code
presented in received update messages. Only if the code matches will a message
with the new RGB value be sent to the light bulb, or the LED state changed using
the
[Wirepas Gateway](https://developer.wirepas.com/support/solutions/articles/77000489804-wirepas-software-and-apis-overview#Wirepas-Gateway-to-Cloud-API).

## Running the Wirepas 5G Mesh bridge

Configure the bridge settings using the `.envrc` (see
[the example](./envrc.example)).

Run:

```bash
npx tsx wirepas-5g-mesh-bridge/bridge.ts
```

Run as a service using systemd:

```bash
systemd-run -E BRIDGE_MQTT_ENDPOINT=${BRIDGE_MQTT_ENDPOINT} -E BRIDGE_AWS_ACCESS_KEY_ID=${BRIDGE_AWS_ACCESS_KEY_ID} -E BRIDGE_AWS_SECRET_ACCESS_KEY=${BRIDGE_AWS_SECRET_ACCESS_KEY} -E BRIDGE_CONNECTIONS_TABLE_NAME=${BRIDGE_CONNECTIONS_TABLE_NAME} -E BRIDGE_WEBSOCKET_MANAGEMENT_API_URL=${BRIDGE_WEBSOCKET_MANAGEMENT_API_URL} --working-directory ${PWD} npx tsx wirepas-5g-mesh-bridge/bridge.ts
```
