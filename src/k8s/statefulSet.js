const _ = require('lodash')
const log = require('bole')('k8s')
const core = require('./core')
const diffs = require('./specDiff')
const parse = require('../imageParser').parse
const retry = require('../retry')

const GROUPS = {
  '1.4': 'apps/v1beta1',
  '1.5': 'apps/v1beta1',
  '1.6': 'apps/v1beta1',
  '1.7': 'apps/v1beta1',
  '1.8': 'apps/v1beta2'
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
  return base(client, namespace).statefulset(name)
}

function multiple (client, namespace, name) {
  return base(client, namespace).statefulsets
}

async function checkStatefulSet (client, namespace, name, outcome) {
  return retry(async () => {
    log.debug(`checking statefulSet status '${namespace}.${name}' for '${outcome}'`)
    try {
      var result = await single(client, namespace, name).get()
    } catch (err) {
      if (outcome === 'deletion') {
        log.debug(`statefulSet '${namespace}.${name}' deleted successfully.`)
        return
      } else {
        log.debug(`statefulSet '${namespace}.${name}' status check got API error. Checking again soon.`)
        throw new Error('continue')
      }
    }

    log.debug(`statefulSet '${namespace}.${name}' status - '${JSON.stringify(result.status, null, 2)}'`)
    if (outcome === 'creation' && result.status.readyReplicas > 0) {
      return result
    } else if (outcome === 'updated' && result.status.readyReplicas > 0) {
      return result
    } else if (outcome === 'deletion' && result.status.phase !== 'Terminating') {
      return result
    }

    throw new Error('continue')
  })
}

async function createStatefulSet (client, deletes, statefulSet) {
  const namespace = statefulSet.metadata.namespace || 'default'
  const name = statefulSet.metadata.name
  let create = async () => {
    await multiple(client, namespace).create(statefulSet)
      .catch(err => {
        throw new Error(`StatefulSet '${namespace}.${name}' failed to create:\n\t${err.message}`)
      })

    await checkStatefulSet(client, namespace, name, 'creation')
  }

  try {
    var loaded = await single(client, namespace, name).get()
  } catch (e) {
    return create()
  }
  const diff = diffs.simple(loaded, statefulSet)
  if (!_.isEmpty(diff)) {
    if (diffs.canPatch(diff)) {
      if (client.saveDiffs) {
        diffs.save(loaded, statefulSet, diff)
      }
      await updateStatefulSet(client, namespace, name, diff)
    } else if (diffs.canReplace(diff)) {
      await replaceStatefulSet(client, namespace, name, statefulSet)
    } else {
      await deleteStatefulSet(client, namespace, name)
      await create()
    }
  }
}

async function deleteStatefulSet (client, namespace, name) {
  try {
    await single(client, namespace, name).get()
  } catch (e) {
    return
  }
  await single(client, namespace, name).delete()
    .catch(err => {
      throw new Error(`StatefulSet '${namespace}.${name}' could not be deleted:\n\t${err.message}`)
    })
  await checkStatefulSet(client, namespace, name, 'deletion')
}

async function getStatefulSetsByNamespace (client, namespace, baseImage) {
  const list = await listStatefulSets(client, namespace)
  let statefulSets = _.reduce(list.items, (acc, spec) => {
    const containers = core.getContainersFromSpec(spec, baseImage)
    containers.forEach(container => {
      const metadata = parse(container.image)
      acc.push({
        namespace: namespace,
        type: 'StatefulSet',
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

  return { namespace, statefulSets }
}

async function listStatefulSets (client, namespace) {
  return multiple(client, namespace).list()
}

async function replaceStatefulSet (client, namespace, name, spec) {
  await single(client, namespace, name).update(spec)
    .catch(err => {
      throw new Error(`StatefulSet '${namespace}.${name}' failed to replace:\n\t${err.message}`)
    })
  await checkStatefulSet(client, namespace, name, 'updated')
}

async function updateStatefulSet (client, namespace, name, patch) {
  await single(client, namespace, name).patch(patch)
    .catch(err => {
      throw new Error(`StatefulSet '${namespace}.${name}' failed to update:\n\t${err.message}`)
    })
  await checkStatefulSet(client, namespace, name, 'updated')
}

async function upgradeStatefulSet (client, namespace, name, image, container) {
  const patch = diffs.getImagePatch(container || name, image)
  await single(client, namespace, name).patch(patch)
    .catch(err => {
      throw new Error(`StatefulSet '${namespace}.${name}' failed to upgrade:\n\t${err.message}`)
    })
  await checkStatefulSet(client, namespace, name, 'update')
}

module.exports = function (client, deletes) {
  return {
    create: createStatefulSet.bind(null, client, deletes),
    delete: deleteStatefulSet.bind(null, client),
    getByNamespace: getStatefulSetsByNamespace.bind(null, client),
    list: listStatefulSets.bind(null, client),
    replace: replaceStatefulSet.bind(null, client),
    update: updateStatefulSet.bind(null, client),
    upgrade: upgradeStatefulSet.bind(null, client)
  }
}
