## hikaru
A deployment automation service for kubernetes. 100 internets if you get the reference. 1000 internets if you get why.

# What Can It Even?

## Find and Upgrade Deployments
Performs upgrade to existing deployments based on matches between the label queries on the deployments and metadata about the Docker image (currently provided implictly by the docker image tag).

### Docker Image Tag
I use [buildgoggles](https://www.npmjs.com/package/buildgoggles) to generate predictable build information and build tags that will work in any build environment (including your local desktop). We then use this to tag our docker image with a tag that follows the format:

```
{owner}_{repo}_{branch}_{version}_{build}_{commit-slug}
```

> Note: build is calculated based on commits and some other things in the git repo so that it will be consistent across machines given the same commit history.

### How/Why Tags And Labels Matter
We label our deployments with the owner, repo and branch and when hikaru is told about a new docker image, it extracts these values from the tag, finds deployments with matching labels and then upgrades deployments where the labels match.

## Run Jobs
In a limited capacity, hikaru has the ability to kick off kubernetes jobs. This is intended to help automate post-deploy tasks. It is recommended that the job definitions are effectively templates that make use of values set by configuration maps managed elsewhere.

## API

### `POST /api/image/{dockerImage}`

Responds with a list of deployments which will receive rolling update calls with the new Docker image.

### `GET /api/image/{repository}/{image}
### `GET /api/image/{registry}/{repository}/{image}

Responds with a list of namespace and services presently using the image. Useful to see which services would be updated given a docker image

### `POST /api/job`
Based on the content type, you can supply `application/json` or `application/yaml` as the job definition

## Environment Variables
All configruation is driven by environment variables:

 * `K8S-URL`
 * `K8S-HOST`
 * `K8S-TOKEN`
 * `K8S-CA`
 * `K8S-CERT`
 * `K8S-KEY`
 * `K8S-USERNAME`
 * `K8S-PASSWORD`

Presently it only uses the basic auth (username & password).

## TO DO

### Version & Build Number Support
Automated upgrades shouldn't happen when the semantic version & build number are _less than_ the existing deployed image's version and build number. This isn't currently something hikaru does. It is further complicated because we (and others likely) take advantage of `latest` style image tags for initial deployments/redeploys. There would need to be some way for hikaru to find a version/build for services or assume that any build wins over latest, etc.

### Automated Upgrade Opt-Out
Hikaru will ignore deployments that don't have owner, repo and branch labels but it could be nice to differentiate between an automated CI/CD deployment and a "human said to force this" deployment. Flagging deployments to opt-out of the automated deploy would be one part of this.

### More auth support?
Based on which variables are available, `hikaru` should determine which authenitcation approach to take. The options are, token, cert & key or username & password. The ca can be provided with the latter two options.
