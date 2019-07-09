# hikaru

A deployment tool for kubernetes. 100 internets if you get the reference. 1000 internets if you get why.

[![Build Status][travis-image]][travis-url]
[![Coverage Status][coveralls-image]][coveralls-url]

# What It Does - Deployments and Continuous Delivery

hikaru was built specifically to make it easy to deploy and maintain kubernetes clusters.

 * Initial deployment
 * Re-deployment/Updates

## Features

 * Deploy [mcgonagall](https://github.com/npm-wharf/mcgonagall) specs from local directory
 * Supports tokenized specifications

## Credential Limitations

hikaru uses `kubectl` under the hood and requires that you have a context configured to target each cluster you wish to deploy to.

# Complimentary Tooling

hikaru requires [mcgonagall](https://github.com/npm-wharf/mcgonagall) style cluster specifications.

hikaru also requires that `kubectl` is installed and available on the `PATH`.

# Modes

hikaru provides 2 possible models for interaction:

 * a CLI for interacting with Kubernetes clusters directly
 * custom use-cases via module

# CLI

Full argument names are shown in the command examples. Shorthand arguments are available, see the interactive CLI help to get a list.

## Installation

```shell
npm i @npm-wharf/hikaru -g
```

## Tokens

If tokens are present in a specification and not provided via a `tokenFile`, hikaru will error and exit, informing you what tokens must be specified. It will refuse to run until all tokens have been defined.

## Deploying Clusters (`deploy`)

Hikaru deploys specs through `kubectl apply` and so changes will be intelligently merged by the cluster.

### Available options

- `--context` (`-c`): the name of the `kubectl` context to deploy to. *required*
- `--tokenFile` (`-f`): path to a file to read for tokens consumed in the spec.
- `--scale` (`-s`): scale factor label to apply, if the given label is not used in your spec this will be ignored.
- `--verbose`: output additional debug information.

Example usage:

```shell
hikaru deploy {spec} \
  --tokenFile {path to json, yaml or toml token file} \
  --context {name of kubectl context} \
  --scale {scaleLabel} \
  --verbose
```

## Running Jobs

The `run` command will delete and apply the job resource again, forcing a new instance to run.

### Available options

- `--job` (`-j`): the name of the job resource to run in the format `name.namespace` *required*
- `--context` (`-c`): the name of the `kubectl` context to deploy to. *required*
- `--tokenFile` (`-f`): path to a file to read for tokens consumed in the spec.
- `--scale` (`-s`): scale factor label to apply, if the given label is not used in your spec this will be ignored.
- `--verbose`: output additional debug information.

Example usage:

```shell
hikaru run {spec} \
  --job {name.namespace, e.g. route53bot.infra} \
  --tokenFile {path to json, yaml or toml token file} \
  --context {name of kubectl context} \
  --scale {scaleLabel} \
  --verbose
```

# Library

## Deploying Cluster

```js
const hikaru = require('hikaru')

hikaru.deploy({
  spec: '/path/to/spec',
  version: '1.13', // kubernetes api version
  data: {
    // tokens to apply to the spec are defined here
  },
  scale: 'medium' // scaleFactor
}) // returns a Promise
```

## Running a Job

```js
const hikaru = require('hikaru')

hikaru.run({
  spec: '/path/to/spec',
  job: 'name.namespace', // the job to run
  version: '1.13', // kubernetes api version
  data: {
    // tokens to apply to the spec are defined here
  },
  scale: 'medium' // scaleFactor
}) // returns a Promise
```

[travis-url]: https://travis-ci.org/npm-wharf/hikaru
[travis-image]: https://travis-ci.org/npm-wharf/hikaru.svg?branch=master
[coveralls-url]: https://coveralls.io/github/npm-wharf/hikaru?branch=master
[coveralls-image]: https://coveralls.io/repos/github/npm-wharf/hikaru/badge.svg?branch=master
