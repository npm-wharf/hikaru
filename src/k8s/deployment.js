const _ = require('lodash')
const log = require('bole')('k8s')
const core = require('./core')
const diffs = require('./specDiff')
const parse = require('../imageParser').parse
const retry = require('../retry')

const GROUPS = {
  '1.4': 'extensions/v1beta1',
  '1.5': 'extensions/v1beta1',
  '1.6': 'apps/v1beta1',
  '1.7': 'apps/v1beta1',
  '1.8': 'apps/v1beta2',
  '1.9': 'apps/v1',
  '1.10': 'apps/v1',
  '1.11': 'apps/v1',
  '1.12': 'apps/v1'
}

function group (client) {
  return GROUPS[client.version]
}

function base (client, namespace) {
  return client
    .group(group(client))
    .ns(namespace)
}

function single (client, namespace, name) {
  return base(client, namespace).deployment(name)
}

function multiple (client, namespace, name) {
  return base(client, namespace).deployments
}

async function checkDeployment (client, namespace, name, outcome) {
  await retry(async () => {
    log.debug(`checking deployment status '${namespace}.${name}' for '${outcome}'`)
    try {
      var result = await single(client, namespace, name).get()
    } catch (e) {
      if (outcome === 'deletion') {
        log.debug(`deployment '${namespace}.${name}' deleted successfully.`)
        return
      } else {
        log.debug(`deployment '${namespace}.${name}' status check got API error. Checking again...`)
        throw new Error('deployment not ready yet')
      }
    }
    log.debug(`deployment '${namespace}.${name}' status - '${JSON.stringify(result.status, null, 2)}'`)
    if (outcome === 'creation' && result.status.readyReplicas > 0) {
      return result
    } else if (outcome === 'updated' && result.status.updatedReplicas > 0 && result.status.readyReplicas > 0) {
      return result
    } else if (outcome === 'deletion' && result.status.phase !== 'Terminating') {
      return result
    }
    throw new Error('deployment not ready yet')
  })
}

async function createDeployment (client, deletes, deployment) {
  const kind = deployment.kind.toLowerCase()
  const namespace = deployment.metadata.namespace || 'default'
  const name = deployment.metadata.name
  let create = async () => {
    await multiple(client, namespace).create(deployment)
      .catch(result => {}, err => {
        throw new Error(`Deployment '${namespace}.${name}' failed to create:\n\t${err.message}`)
      })
    await checkDeployment(client, namespace, name, 'creation')
  }

  try {
    var loaded = await single(client, namespace, name).get()
  } catch (e) {
    return create()
  }
  const diff = diffs.simple(loaded, deployment)
  if (!_.isEmpty(diff)) {
    if (diffs.canPatch(diff)) {
      if (client.saveDiffs) {
        diffs.save(loaded, deployment, diff)
      }
      await updateDeployment(client, namespace, name, diff)
    } else if (diffs.canReplace(diff)) {
      await replaceDeployment(client, namespace, name, deployment)
    } else {
      await deletes[kind](client, namespace, name)
    }
  }
}

async function deleteDeployment (client, namespace, name) {
  try {
    await single(client, namespace, name).get()
  } catch (e) {
    return
  }
  await single(client, namespace, name).delete()
    .catch(err => {
      throw new Error(`Deployment '${namespace}.${name}' could not be deleted:\n\t${err.message}`)
    })
  await checkDeployment(client, namespace, name, 'deletion')
}

async function getDeploymentsByNamespace (client, namespace, baseImage) {
  const list = await listDeployments(client, namespace)
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
        labels: spec.spec.template.metadata
          ? spec.spec.template.metadata.labels
          : metadata.labels || {}
      })
    })
    return acc
  }, [])

  return { namespace, deployments }
}

async function listDeployments (client, namespace) {
  return multiple(client, namespace).list()
}

async function replaceDeployment (client, namespace, name, spec) {
  await single(client, namespace, name).update(spec)
    .catch(err => {
      throw new Error(`Deployment '${namespace}.${name}' failed to replace:\n\t${err.message}`)
    })

  await checkDeployment(client, namespace, name, 'updated')
}

async function updateDeployment (client, namespace, name, diff) {
  await single(client, namespace, name).patch(diff)
    .catch(err => {
      throw new Error(`Deployment '${namespace}.${name}' failed to update:\n\t${err.message}`)
    })

  await checkDeployment(client, namespace, name, 'updated')
}

async function upgradeDeployment (client, namespace, name, image, container) {
  const patch = diffs.getImagePatch(container || name, image)
  await single(client, namespace, name).patch(patch)
    .catch(err => {
      throw new Error(`Deployment '${namespace}.${name}' failed to upgrade:\n\t${err.message}`)
    })

  await checkDeployment(client, namespace, name, 'updated')
}

module.exports = function (client, deletes) {
  return {
    create: createDeployment.bind(null, client, deletes),
    delete: deleteDeployment.bind(null, client),
    getByNamespace: getDeploymentsByNamespace.bind(null, client),
    list: listDeployments.bind(null, client),
    replace: replaceDeployment.bind(null, client),
    update: updateDeployment.bind(null, client),
    upgrade: upgradeDeployment.bind(null, client)
  }
}
