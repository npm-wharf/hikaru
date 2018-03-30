# hikaru

A deployment and continuous delivery tool for kubernetes. 100 internets if you get the reference. 1000 internets if you get why.

[![Build Status][travis-image]][travis-url]
[![Coverage Status][coveralls-image]][coveralls-url]

# What It Does - Deployments and Continuous Delivery

hikaru was built specifically to make it easy to deploy and maintain kubernetes clusters.

 * Initial deployment
 * Re-deployment/Updates
 * Removal/clean-up

## Features

 * Deploy from git repository
 * Deploy from tarball
 * Deploy from target directory
 * Supports tokenized specifications
 * Diff based re-deploy
 * Continuous delivery support

## Credential Limitations

hikaru assumes that git and Docker interaction that require credentials will have them based on the context the commands are run in.

### Git Credentials

hikaru does not accept git credentials nor will it store and fetch them. If the cluster spec provided by a call isn't public, then the expectation is that the git client already has the credentials necessary to access the private repository.

### Docker Credentials

hikaru also does not accept docker credentials nor will it store and fetch them. When an image is specified by a manifest or by an upgrade call that is not publicly available, the expectation is that the Kubernetes cluster has been configured with credentials necessary to acquire the Docker image.

# Complimentary Tooling

hikaru requires [mcgonagall](https://github.com/npm-wharf/mcgonagall) style cluster specifications. You'll get the most mileage out of it by adopting [shipwright](https://github.com/npm-wharf/shipwright) to build your Docker images or at least using a compatible tagging approach (see: [buildgoggles](https://www.npmjs.com/package/buildgoggles)). These complimentary aspects come largely from how hikaru infers metadata about Kubernetes resources based on the Docker image name and tag.

# Modes

hikaru provides 3 possible models for interaction:

 * a CLI for interacting with Kubernetes clusters directly
 * an HTTP API for hosting it directly in-cluster
 * custom use-cases via module

# Continuous Delivery

hikaru's upgradeImage call (designed to call via Web Hook) determines which Deployments would qualify for an upgrade based on the image's tag and performs rolling upgrades. Limitations to this behavior can be introduced via metadata on the Kubernetes manifests themselves.

In practice, hikaru is able to perform automated rolling upgrades out of the box with no additional metadata on the manifests. Metadata added to the manifests provides ways to control the criteria hikaru uses to perform upgrades.

## How hikaru Filters By Manifest Metadata Labels 

By default, hikaru will upgrade images if the version or build is newer and the following criteria match:

* `imageName`
* `imageOwner`
* `owner`
* `repo`
* `branch`

The following labels act like additional filters that hikaru will use against the image metadata it determines from the tag. If these labels are present under the manifest's `spec.template.metadata.labels` then they will be used to determine whether a new image is compatible with the manifest.

This allows you to filter out builds from owners, branches, etc. that you don't want hikaru to deploy over a certain environment/manifest:
 
 * `owner` - limit deployments to a specific repo owner
 * `repo` - limit deployments to a specific repo
 * `branch` - limit deployments to a specific branch
 * `version` - limit to new builds of a specific version
 * `commit` - **!caution!** locks the deployment to a specific commit
 * `filter` - provide a comma delimited list of fields to filter on based on the current image

### More About The Filter Label

The `filter` label was introduced so that you can dynamically assign filter values based on the current image without having to specify them in the manifest explicitly.

This allows you to change what's in effect by forcing an upgrade to the image but not having to change the labels themselves.

Examples: 

Lock a resource down to the same owner, repository, and branch:

> Note: code snippets demonstrate mcgonagall spec

```toml
labels = 'filter=owner,repo,branch'
```

Lock a resource down to the same owner, repository, branch, and version:

```toml
labels = 'owner,repo,branch,version'
```

Possible values:

  * `imageName`
  * `imageOwner`
  * `owner`
  * `repo`
  * `branch`
  * `fullVersion`
  * `version`
  * `build`
  * `commit`

## How hikaru Reads The Tag

### Tag Parsing

hikaru understands how to process the following tag styles:

 * if the build is from the master branch
 	* `latest` - the latest build from our master branch
 	* `major` - the major part of the semantic version
 	* `major.minor` - the major and minor parts of the semantic version
  * `major.minor.patch` - full semantic version
  * `version-prebuild` - any previous semantic version example followed by a prebuild specifier
 * `{version}_{build}_{commit-slug}`
 * `{branch}_{version}_{build}_{commit-slug}`
 * A tag generated by builgGoggles could include: `{owner}_{repo}_{branch}_{version}_{build}_{commit-slug}` to allow for builds of forks and builds where multiple images are generated from a single repo.

hikaru will attempt to filter out additional tag noise and also treat any `-{label}` following a version number as a pre-release.

### Metadata Inference

hikaru will determine or infer 6 pieces of information about a Docker image:

 * Docker image (two parts)
     * repo: if it's empty, it's an official repo, it's set to the image name
     * name: the actual image name
     * examples: 
         * `redis` - image = `redis/redis`
         * `mhart/alpine-node` - image = `mhart/alpine-node`
 * Owner
 	* hikaru only parses this out of the first position of a tag with 5+ elements
 	* if not specified, this is inferred from the image's owner name
  * when missing entirely, this is assumed to be an `official` image
 	* examples:
 		* `npm/app:arobson_master_1.0.1_10_abcd1234` - owner = `arobson`
 		* `npm/app:latest` - owner = `npm`
    * `nginx:13-alpine` - owner = `official`
 * Branch
 	* parsed from the front of tags with 4 elements or
 	* conditionally from larger tags depending on element count
 	* if not specified, hikaru infers `master`
 	* examples:
 		* `npm/app:arobson_test_1.0.1_10_abcd1234` - branch = `test`
 		* `npm/app:now-with-more-stuff_1.0.1_10_abcd1234` - branch = `now-with-more-stuff`
 		* `npm/app:1.0` - branch = `master`
 		* `npm/app:1` - branch = `master`
 		* `npm/app:latest` - branch = `master`
 * Version
 	* hikaru has a nuanced reading of versioning
 	* its goal is to determine if an image would be considered a "newer" version of an existing version
 	* easiest to understand by example:
 		* `npm/app:latest` - `latest`
 		* `npm/app:1` - `latest 1.x.x`
 		* `npm/app:1.1` - `latest 1.1.x`
 		* `npm/app:arobson_test_1.0.1_10_abcd1234` - `1.0.1`
 * Build Number
 	* unlike other values, hikaru does not infer a build when its not in the tag
 	* it shows when one image is newer than another
 	* always comes immediately after the version in a tag
 * Commit SHA/Slug
 	* like the build number, never inferred
 	* only valuable as a `lock` when testing development builds
 	* always 8 characters at the end of the tag

### Examples

Here are a few examples to demonstrate how hikaru would read a few tags.

`nginx`
```js
{
  imageOwner: 'official', // inferred
  imageName: 'nginx',
  owner: 'official', // inferred
  repo: 'nginx', // inferred
  branch: 'master', // inferred
  version: 'latest', // inferred
  build: undefined,
  commit: undefined
}
```

`arobson/hikaru:1`
```js
{
  imageOwner: 'arobson',
  imageName: 'hikaru',
  owner: 'arobson', // inferred
  repo: 'hikaru', // inferred
  branch: 'master', // inferred
  version: '1.x.x',
  build: undefined,
  commit: undefined
}
```


`arobson/kickerd:1.1-alpha_demo_10`
```js
{
  imageOwner: 'arobson',
  imageName: 'kickerd',
  owner: 'arobson', // inferred
  repo: 'kickerd', // inferred
  branch: 'master', // inferred
  version: '1.1.x-alpha',
  build: '10',
  commit: undefined
}
```


`arobson/hikaru:dev_1.1.0_1_a1b2c3d4`
```js
{
  imageOwner: 'arobson',
  imageName: 'hikaru',
  owner: 'arobson', // inferred
  repo: 'hikaru', // inferred
  branch: 'dev',
  version: '1.1.0',
  build: '1',
  commit: 'a1b2c3d4'
}
```

`npm/awesome:arobson_secret_master_0.0.1_10_a00b00c2`
```js
{
  imageOwner: 'npm',
  imageName: 'awesome',
  owner: 'arobson',
  repo: 'secret',
  branch: 'master',
  version: '0.0.1',
  build: '10',
  commit: 'a00b00c2'
}
```

# HTTP Service

## API

### Deploy Cluster

**Deploy From Git**
`POST /api/cluster/{gitHost}/{repoOwner}/{repoName}`
`POST /api/cluster/{gitHost}/{repoOwner}/{repoName}/{branch}`
`application/json`

The POST body allows you to supply any tokens that exist in the spec. If tokens are present in the spec and not provided, a 400 will result with a list of the missing tokens.

**Deploy From Tarball**

`POST /api/cluster`
`application/x-tar`

The POST body will have to be multi-part to include both the tarball and a set of tokens if the specification requires them.

### Remove Cluster

The delete actions requires the same specification used to create it (including any tokens). That's because hikaru reverses the deploy steps rather than just aggressively deleting everything from the cluster.

This also prevents you from deleting resources that weren't deployed as part of your spec.

**Remove From Git**
`DELETE /api/cluster/{gitHost}/{repoOwner}/{repoName}`
`DELETE /api/cluster/{gitHost}/{repoOwner}/{repoName}/{branch}`
`application/json`

The DELETE body allows you to supply any tokens that exist in the spec. If tokens are present in the spec and not provided, a 400 will result with a list of the missing tokens.

**Remove From Tarball**

`DELETE /api/cluster`
`application/x-tar`

The DELETE body will have to be multi-part to include both the tarball and a set of tokens if the specification requires them.

### Get Upgrade Candidates

Returns a hash containing lists of resources. 
 * `upgrade` has the list of resources eligible for upgrade. 
 * `obsolete` is the list of compatible resources that have a newer version than the posted image
 * `equal` is the list of compatible resources that already have the image
 * `error` is the list of resources that were ignored which includes a `diff` property with a brief explanation of why they were ignored 

`GET /api/image/{image}?filter=`
`GET /api/image/{repo}/{image}?filter=`
`GET /api/image/{registry}/{repo}/{image}?filter=`

The filter query parameters accepts a comma delimited list of fields that you want used to determine upgrade eligibility. Valid fields are:

  * `imageName`
  * `imageOwner`
  * `owner`
  * `repo`
  * `branch`
  * `fullVersion`
  * `version`
  * `build`
  * `commit`

The reason for the multiple forms may not be obvious until you see examples:

`GET /api/image/nginx:1.13-alpine`
`GET /api/image/arobson/hikaru:latest`
`GET /api/image/quay.io/coreos/etcd:v3.3.3`

You could make the last form more permissive by telling it to only consider the `imageOwner`:

`GET /api/image/quay.io/coreos/etcd:v3.3.3?filter=imageOwner`

So that it would upgrade any resource using any `etcd` image regardless of whether or not it was the coreos Docker image or not.

### Upgrade Resources With Image

Returns a hash containing lists of resources. 
 * `upgrade` has the list of resources upgraded. 
 * `obsolete` is the list of compatible resources that have a newer version than the posted image
 * `equal` is the list of compatible resources that already have the image
 * `error` is the list of resources that were ignored which includes a `diff` property with a brief explanation of why they were ignored 

`POST /api/image/{image}?filter=`
`POST /api/image/{repo}/{image}?filter=`
`POST /api/image/{registry}/{repo}/{image}?filter=`

The filter query parameters accepts a comma delimited list of fields that you want used to determine upgrade eligibility. Valid fields are:

  * `imageName`
  * `imageOwner`
  * `owner`
  * `repo`
  * `branch`
  * `fullVersion`
  * `version`
  * `build`
  * `commit`

The reason for the multiple forms may not be obvious until you see examples:

`POST /api/image/nginx:1.13-alpine`
`POST /api/image/arobson/hikaru:latest`
`POST /api/image/quay.io/coreos/etcd:v3.3.3`

You could make the last form more permissive by telling it to only consider the `imageOwner`:

`POST /api/image/quay.io/coreos/etcd:v3.3.3?filter=imageOwner`

So that it would upgrade any resource using any `etcd` image regardless of whether or not it was the coreos Docker image or not.

### Find Resources By Image

Returns metadata for any resource that has an image matching the text supplied.

`GET /api/resource/{image}`
`GET /api/resource/{repo}/{image}`
`GET /api/resource/{registry}/{repo}/{image}`

The primary difference between this and the call for upgrade candidates is that this considers anything that matches whatever image segment is provided and returns a single list with no consideration given to upgrade eligibility.

It's just there to make it easy to:

 * get a list of manifests using any nginx image
 * find a list of manifests from a specific image owner
 * find out if any manifests are using a particular version

## Environment Variables
When running as a service, all configuration is driven by environment variables:

 * `K8S-URL`
 * `K8S-HOST`
 * `K8S-TOKEN`
 * `K8S-CA`
 * `K8S-CERT`
 * `K8S-KEY`
 * `K8S-USERNAME`
 * `K8S-PASSWORD`
 * `API_TOKEN` - a token to use with keys
 * `LOCAL_PRIVATE_KEY` - path to secret private key
 * `REMOTE_PUBLIC_KEY` - path to shared public key

The `API_TOKEN` allows you to set a bearer token to secure the API endpoints. This presents only a moderate level of security.

The purpose of the `LOCAL_PRIVATE_KEY` and `REMOTE_PUBLIC_KEY` is to allow multiple hikaru deployments to communicate with a single upstream securely without having to rely solely on a single shared token. It creates a situation where an attacker would need to compromise both the hikaru and calling systems in order to get both sets of keys and the token.

# CLI

Full argument names are shown in the command examples. Shorthand arguments are available, see the interactive CLI help to get a list.

## Installation

```shell
npm i @arobson/hikaru -g
```

## Authentication

Only one of three forms is required. The `user` and `password` arguments (and optionally `ca`) will auth via basic. Using `token` (`ca` is also optional here) will auth via bearer token. Otherwise, the `ca`, `cert` and `key` are required to auth via certificates.

## Tokens

If tokens are present in a specification and not provided via a `tokenFile`, hikaru will prompt you for each of the tokens in turn. Skipping a token or proving a blank answer is not an option.

## Deploying Clusters

When deploying a spec that has already been deployed, hikaru will attempt to diff all manifests included and ignore identical resources while performing a rolling update (where available) on changed manifests.

### `saveDiffs`

A `saveDiffs` flag will cause any detected changes to be saved in a `diff` folder which includes the original, new and diff versions of each manifest that was updated in this way.

### `scale`

The scale factor label depends on the cluster specification. If a label is specified that does not exist in the spec or the spec is missing `scaleOrder` (i.e. the scale cannot be applied) - hikaru will ignore this flag and deploy the specification as specified with defaults.

```shell
hikaru deploy {spec} \
  --url {kubernetes url} \
  --tokenFile {path to json, yaml or toml token file} \
  --user {username} \
  --password {password} \
  --token {token} \
  --ca {path to cluster CA} \
  --cert {path to client cert} \
  --key {path to client key} \
  --scale {scaleLabel} \
  --saveDiffs \
  --verbose
```

## Removing Clusters

```shell
hikaru deploy {spec} \
  --url {kubernetes url} \
  --tokenFile {path to json, yaml or toml token file} \
  --user {username} \
  --password {password} \
  --token {token} \
  --ca {path to cluster CA} \
  --cert {path to client cert} \
  --key {path to client key} \
  --verbose
```

## Upgrading Images

The filter argument accepts a comma delimited list of fields used to determine upgrade eligibility. Valid fields are:

  * `imageName`
  * `imageOwner`
  * `owner`
  * `repo`
  * `branch`
  * `fullVersion`
  * `version`
  * `build`
  * `commit`

```shell
hikaru upgrade {image} \
  --url {kubernetes url} \
  --filter {comma delimited filter option} \
  --user {username} \
  --password {password} \
  --token {token} \
  --ca {path to cluster CA} \
  --cert {path to client cert} \
  --key {path to client key} \
  --verbose
```

## Getting Upgrade Candidates

The filter argument accepts a comma delimited list of fields used to determine upgrade eligibility. Valid fields are:

  * `imageName`
  * `imageOwner`
  * `owner`
  * `repo`
  * `branch`
  * `fullVersion`
  * `version`
  * `build`
  * `commit`

```shell
hikaru candidates {image} \
  --url {kubernetes url} \
  --filter {comma delimited filter option} \
  --user {username} \
  --password {password} \
  --token {token} \
  --ca {path to cluster CA} \
  --cert {path to client cert} \
  --key {path to client key} \
  --verbose
```

## Finding Resources By Image

```shell
hikaru findByImage {image} \
  --url {kubernetes url} \
  --user {username} \
  --password {password} \
  --token {token} \
  --ca {path to cluster CA} \
  --cert {path to client cert} \
  --key {path to client key} \
  --verbose
```

## Aliasing Clusters and Caching Credentials

*If* you are comfortable storing cluster credentials in your home directory, you can use hikaru's `login` command to alias a kubernetes cluster endpoint and the auth information under an alias. This will allow you to use the alias argument (`--alias` or `-a`) so that you won't have to provide the url, auth or even version argument to each of the other commands

```shell
hikaru alias \
  --url {kubernetes url} \
  --user {username} \
  --password {password} \
  --token {token} \
  --ca {path to cluster CA} \
  --cert {path to client cert} \
  --key {path to client key} \
  --version {api version for the cluster}
```

# Library

hikaru uses [`fount`](https://github.com/arobson/fount) to supply dependencies on demand. This will affect how you use it to control configuration if you want to set it via a method other than the environment variables:

```js
const hikaru = require('hikaru')

// make config changes *before* making any
// hikaru calls
const fount = require('fount')
const config = fount.get('config')
config.url = '' // the kubernetes url
config.username = '' // basic auth username
config.password = '' // basic auth password
config.token = '' // bearer token
config.ca = '' // kubernetes CA
config.cert = '' // kubernetes client cert
config.key = '' // kubernetes client key

// note: the ca, cert, and key would all
// need to be loaded from the file
// DO NOT provide a filename, it won't work
```

## Deploying Cluster

```js
const hikaru = require('hikaru')

hikaru.deployCluster(
  'git://github.com/me/my-spec', 
  {
    branch: 'special', // 'master' is default
    // kubernetes API/cluster version
    version: '1.8', // '1.7' is default
    scale: 'medium', // no default value
    data: {
      token1: 'value'
      token2: 100
    }
  })
  .then(
    () => {},
    err => {}
  )
```

## Removing Cluster

```js
const hikaru = require('hikaru')

hikaru.removeCluster(
  'git://github.com/me/my-spec', 
  {
    branch: 'special', // 'master' is default
    // kubernetes API/cluster version
    version: '1.8', // '1.7' is default
    data: {
      token1: 'value'
      token2: 100
    }
  })
  .then(
    () => {},
    err => {}
  )
```

## Upgrading Image

Note: the filter option defaults to:

```js
['imageName', 'imageOwner', 'owner', 'repo', 'branch']
```

Which limits upgrades so that they'll only happen when the resource matches the image on these 5 fields.

This can be changed to be *more* or *less* permissive but should be done with great care. An empty filter should NEVER BE SUBMITTED as it would effectively be telling hikaru to replace all running pods with the same image.

```js
const hikaru = require('hikaru')

hikaru.upgradeImage(
  'myRepo/myImage:1.1.0',
  {
    filter: ['imageOwner', 'imageName']
  })
  .then(
    list => {
      // list of upgraded resources
    },
    err => {}
  )
```

## Getting Upgrade Candidates

Works like the upgrade command but instead of performing the upgrade, only returns the list of resources that would be upgraded.

Very useful for checking to see which resources would be affected before running a command.

It is recommended to use this to check with users before running the actual upgrade - especially if they've been allowed to change any filter settings.

```js
const hikaru = require('hikaru')

hikaru.getCandidatesImage(
  'myRepo/myImage:1.1.0',
  {
    filter: ['imageOwner', 'imageName']
  })
  .then(
    list => {
      // list of upgraded resources
    },
    err => {}
  )
```

## Finding Resources By Image

Performs a search in the cluster for resources with an image containing the provided string.

Useful for trying to see which things might be in use across various owners. Example: searching for `nginx` to see how many different NGiNX containers might be deployed.

```js
const hikaru = require('hikaru')

hikaru.findResources('nginx')
  .then(
    list => {
      // list of matching resources
    },
    err => {}
  )
```

## Custom Cases

> Caveat Emptor: I do not have time (presently) to document the extensive cluster and k8s module APIs or provide adequate test coverage for them. You are using them at your own risk.

```js
const hikaru = require('hikaru')
hikaru.connect()
  .then(() => {
    // both `.k8s` and `.cluster` will be available
    // on hikaru after the connect promise resolves
  })
```

# Docker Image

A Docker image containing the hikaru HTTP service is already built for ease of use:

`npmwharf/hikaru:latest`

And also released with various version tagging schemes.

To use it, you can set the various environment variables to control behavior. To use it inside a Kubernetes cluster, I recommend pulling in the token and CA token that Kubernetes places in the pods. See the Kubernetes spec (below) for reference.

# Kubernetes Spec

A mcgonagall kubernetes spec to deploy hikaru to a kubernetes cluster can be found at [`https://github.com/npm-wharf/hikaru-spec`](https://github.com/npm-wharf/hikaru-spec).

It's likely you'll want to copy `hikaru.toml` into your own full cluster specification to get the benefit of mgconagall's NGiNX generation. If that's not something you want though, you can simply deploy directly from the github repo using the CLI:

```shell
hikaru deploy git://github.com/npm-wharf/hikaru-spec \
 -k {your cluster endpoint} \
 -u {username} \
 -p {password}
```

> Note: there are other auth methods available, the cert approach is probably best :)

[travis-url]: https://travis-ci.org/npm-wharf/hikaru
[travis-image]: https://travis-ci.org/npm-wharf/hikaru.svg?branch=master
[coveralls-url]: https://coveralls.io/github/npm-wharf/hikaru?branch=master
[coveralls-image]: https://coveralls.io/repos/github/npm-wharf/hikaru/badge.svg?branch=master
