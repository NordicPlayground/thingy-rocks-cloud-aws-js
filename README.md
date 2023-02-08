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

## Running the Wirepas 5G Mesh bridge

Configure the bridge settings using the `.envrc` (see
[the example](./envrc.example)).

Run:

```
npx tsx wirepas-5g-mesh-bridge/bridge.ts
```
