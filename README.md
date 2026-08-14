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
aws ssm put-parameter --name thingy-rocks-backend-Wirepas5GMeshGatewayEndpoint --type String --value $WIREPAS_GATEWAY_MQTT_ENDPOINT
```

### Deploy

> [!NOTE]  
> Requires [go](https://go.dev/) to be installed.

```bash
npm run build:container
# export the environment variable UDP_INGEST_CONTAINER_TAG as printed
npx cdk deploy
```

### Enable AWS IoT Thing Index

Enable AWS IoT Thing indexing for the lwm2m named shadow and Thing connectivity.

### Running the Wirepas 5G Mesh Gateway

Create a thing type `wirepas-5g-mesh-gateway`.

Configure the gateway settings using the `.envrc` (see
[the example](./.envrc.example)).

Run:

```bash
node --experimental-transform-types --no-warnings wirepas-5g-mesh-gateway/gateway.ts
```

Run as a service using systemd:

```bash
systemd-run -E WIREPAS_GATEWAY_MQTT_ENDPOINT=${WIREPAS_GATEWAY_MQTT_ENDPOINT} -E WIREPAS_GATEWAY_AWS_ACCESS_KEY_ID=${WIREPAS_GATEWAY_AWS_ACCESS_KEY_ID} -E WIREPAS_GATEWAY_REGION=${WIREPAS_GATEWAY_REGION} -E WIREPAS_GATEWAY_AWS_SECRET_ACCESS_KEY=${WIREPAS_GATEWAY_AWS_SECRET_ACCESS_KEY} --working-directory ${PWD} node --experimental-transform-types --no-warnings wirepas-5g-mesh-gateway/gateway.ts
```

### Memfault integration

Configure these SSM parameters:

```bash
aws ssm put-parameter --name /thingy-rocks-backend/memfault/organizationAuthToken --type String --value <Memfault Organization Auth Token>
aws ssm put-parameter --name /thingy-rocks-backend/memfault/organizationId --type String --value <Memfault Organization ID>
aws ssm put-parameter --name /thingy-rocks-backend/memfault/projectId --type String --value <Memfault Project ID>
```

### UDP ingress

`udp.ingress.thingy.rocks` receives UDP packages on the following ports:

- Port `6666`: Plain text CSV format (IMEI, timestamp, ping, rsrp, band,
  ue_mode, operator, latitude, longitude, accuracy, battery, temp, pressure,
  humidity)
- Port `6667`: CBOR-encoded SenML containing LwM2M objects

### API domain

A hosted Zone is created by the deployment.

Create a `NS` record in the DNS settings for `thingy.rocks` (in CloudFlare),
with the `ingress.thingy.rocks` as the name and the list of nameservers from the
output.
