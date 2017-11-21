const _ = require('lodash')
const log = require('bole')('k8s')
const Promise = require('bluebird')
const core = require('./core')
const diffs = require('./specDiff')
const parse = require('../imageParser').parse

function base (client, namespace) {
  return client
    .group('apps')
    .ns(namespace)
}

function single (client, namespace, name) {
  return base(client, namespace).deployment(name)
}

function multiple (client, namespace, name) {
  return base(client, namespace).deployments
}

function checkDeployment (client, namespace, name, outcome, resolve, wait) {
  let ms = wait || 500
  let next = ms + (ms / 2)
  if (next > 5000) {
    next = 5000
  }
  setTimeout(() => {
    log.debug(`checking deployment status '${namespace}.${name}' for '${outcome}'`)
    single(client, namespace, name).get()
      .then(
        result => {
          log.debug(`deployment '${namespace}.${name}' status - '${JSON.stringify(result.status, null, 2)}'`)
          if (outcome === 'creation' && result.status.readyReplicas > 0) {
            resolve(result)
          } else if (outcome === 'updated' && result.status.updatedReplicas > 0 && result.status.readyReplicas > 0) {
            resolve(result)
          } else if (outcome === 'deletion' && result.status.phase !== 'Terminating') {
            resolve(result)
          } else {
            checkDeployment(client, namespace, name, outcome, resolve, next)
          }
        },
        () => {
          if (outcome === 'deletion') {
            log.debug(`deployment '${namespace}.${name}' deleted successfully.`)
            resolve()
          } else {
            log.debug(`deployment '${namespace}.${name}' status check got API error. Checking again in ${next} ms.`)
            checkDeployment(client, namespace, name, outcome, resolve, next)
          }
        }
      )
  }, ms)
}

function createDeployment (client, deployment) {
  const namespace = deployment.metadata.namespace || 'default'
  const name = deployment.metadata.name
  let create = (resolve, reject) =>
    multiple(client, namespace).create(deployment)
    .then(
      result => {
        checkDeployment(client, namespace, name, 'creation', resolve)
      },
      err => {
        reject(new Error(`Deployment '${namespace}.${name}' failed to create:\n\t${err.message}`))
      }
    )

  return new Promise((resolve, reject) => {
    single(client, namespace, name).get()
      .then(
        loaded => {
          const diff = diffs.simple(loaded, deployment)
          if (_.isEmpty(diff)) {
            resolve()
          } else {
            if (diffs.canPatch(diff)) {
              if (client.saveDiffs) {
                diffs.save(loaded, deployment, diff)
              }
              updateDeployment(client, namespace, name, diff)
                .then(
                  resolve,
                  reject
                )
            } else {
              replaceDeployment(client, namespace, name, deployment)
                .then(
                  resolve,
                  reject
                )
            }
          }
        },
        create.bind(null, resolve, reject)
      )
  })
}

function deleteDeployment (client, namespace, name) {
  return new Promise((resolve, reject) => {
    single(client, namespace, name).get()
      .then(
        () => {
          single(client, namespace, name).delete()
            .then(
              result => {
                checkDeployment(client, namespace, name, 'deletion', resolve)
              },
              err => {
                reject(new Error(`Deployment '${namespace}.${name}' could not be deleted:\n\t${err.message}`))
              }
            )
        },
        () => resolve()
      )
  })
}

function getDeploymentsByNamespace (client, namespace, baseImage) {
  return listDeployments(client, namespace)
      .then(
        list => {
          let deployments = _.reduce(list.items, (acc, spec) => {
            const containers = core.getContainersFromSpec(spec, baseImage)
            containers.forEach(container => {
              const metadata = parse(container.image)
              acc.push({
                namespace: namespace,
                type: 'Deployments',
                service: spec.metadata.name,
                image: container.image,
                container: container.name,
                metadata: metadata,
                labels: spec.template.metadata
                  ? spec.template.metadata.labels
                  : {}
              })
            })
            return acc
          }, [])
          return { namespace, deployments }
        }
      )
}

function listDeployments (client, namespace) {
  return multiple(client, namespace).list()
}

function replaceDeployment (client, namespace, name, spec) {
  return new Promise((resolve, reject) => {
    single(client, namespace, name).update(spec)
      .then(
        result => {
          checkDeployment(client, namespace, name, 'updated', resolve)
        },
        err => {
          reject(new Error(`Deployment '${namespace}.${name}' failed to replace:\n\t${err.message}`))
        }
      )
  })
}

function updateDeployment (client, namespace, name, diff) {
  return new Promise((resolve, reject) => {
    single(client, namespace, name).patch(diff)
      .then(
        result => {
          checkDeployment(client, namespace, name, 'updated', resolve)
        },
        err => {
          reject(new Error(`Deployment '${namespace}.${name}' failed to update:\n\t${err.message}`))
        }
      )
  })
}

function upgradeDeployment (client, namespace, name, image, container) {
  const patch = diffs.getImagePatch(container || name, image)
  return new Promise((resolve, reject) => {
    single(client, namespace, name).patch(patch)
      .then(
        result => {
          checkDeployment(client, namespace, name, 'updated', resolve)
        },
        err => {
          reject(new Error(`Deployment '${namespace}.${name}' failed to upgrade:\n\t${err.message}`))
        }
      )
  })
}

module.exports = function (client) {
  return {
    create: createDeployment.bind(null, client),
    delete: deleteDeployment.bind(null, client),
    getByNamespace: getDeploymentsByNamespace.bind(null, client),
    list: listDeployments.bind(null, client),
    replace: replaceDeployment.bind(null, client),
    update: updateDeployment.bind(null, client),
    upgrade: upgradeDeployment.bind(null, client)
  }
}
