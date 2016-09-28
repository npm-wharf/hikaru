## hikaru
A deployment automation service for kubernetes. 100 internets if you get the reference. 1000 internets if you get why.

## What it does
Performs rolling upgrade to existing deployments based on matches between the label queries on the deployments and metadata about the Docker image (currently provided implictly by the image tag).

## API

### `POST /api/{dockerImage}`

Responds with a list of deployments which will receive rolling update calls with the new Docker image.


## Environment Variables
All configruation is driven by environment variables:

 * `K8S-URL`
 * `K8S-TOKEN`
 * `K8S-CA`
 * `K8S-CERT`
 * `K8S-KEY`
 * `K8S-USERNAME`
 * `K8S-PASSWORD`

Presently it only uses the basic auth (username & password).

### TO DO
Based on which variables are available, `hikaru` should determine which authenitcation approach to take. The options are, token, cert & key or username & password. The ca can be provided with the latter two options.
