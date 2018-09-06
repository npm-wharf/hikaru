const _ = require('lodash')
const log = require('bole')('k8s')
const core = require('./core')
const diffs = require('./specDiff')
const parse = require('../imageParser').parse
const retry = require('../retry')


const GROUPS = {
  '1.4': 'extensions/v1beta1',
  '1.5': 'extensions/v1beta1',
  '1.6': 'extensions/v1beta1',
  '1.7': 'extensions/v1beta1',
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
  return base(client, namespace).daemonset(name)
}

function multiple (client, namespace, name) {
  return base(client, namespace).daemonsets
}

async function checkDaemonSet (client, namespace, name, outcome,) {
  retry(async bail => {
    log.debug(`checking daemonSet status '${namespace}.${name}' for '${outcome}'`)
    try {
      var result = await single(client, namespace, name).get()
    } catch (err) {
      if (outcome === 'deletion') {
        log.debug(`daemonSet '${namespace}.${name}' deleted successfully.`)
        return
      } else {
        log.debug(`daemonSet '${namespace}.${name}' status check got API error. Checking again soon.`)
        bail(new Error('continue'))
      }
    }

    log.debug(`daemonSet '${namespace}.${name}' status - '${JSON.stringify(result.status, null, 2)}'`)
    if ((outcome === 'creation' || outcome === 'update') && result.status.numberReady === result.status.desiredNumberScheduled) {
      return result
    } else if (outcome === 'deletion' && result.status.phase !== 'Terminating') {
      return result
    }
    bail(new Error('continue'))
  })
}

async function createDaemonSet (client, deletes, daemonSet) {
  const namespace = daemonSet.metadata.namespace || 'default'
  const name = daemonSet.metadata.name

  let create = async () => {
    multiple(client, namespace).create(daemonSet)
      .catch(err => {
        throw new Error(`DaemonSet '${namespace}.${name}' failed to create:\n\t${err.message}`)
      })
    return checkDaemonSet(client, namespace, name, 'creation')
  }

  try {
    var loaded = await single(client, namespace, name).get()
  } catch (err) {
    return create()
  }

  const diff = diffs.simple(loaded, daemonSet)
  if (!_.isEmpty(diff)) {
    if (diffs.canPatch(diff)) {
      if (client.saveDiffs) {
        diffs.save(loaded, daemonSet, diff)
      }
      await patchDaemonSet(client, namespace, name, diff)
    } else if (diffs.canReplace(diff)) {
      await replaceDaemonSet(client, namespace, name, daemonSet)
    } else {
      await deleteDaemonSet(client, namespace, name)
      return create()
    }
  }
}

async function deleteDaemonSet (client, namespace, name) {
  try {
    await single(client, namespace, name).get()
  } catch (err) {
    return
  }
  await single(client, namespace, name).delete()
    .catch(err => {
      throw new Error(`DaemonSet '${namespace}.${name}' could not be deleted:\n\t${err.message}`)
    })
  await checkDaemonSet(client, namespace, name, 'deletion')
}

async function getDaemonSetsByNamespace (client, namespace, baseImage) {
  const list = await listDaemonSets(client, namespace)
  let daemonSets = _.reduce(list.items, (acc, spec) => {
    const containers = core.getContainersFromSpec(spec, baseImage)
    containers.forEach(container => {
      const metadata = parse(container.image)
      acc.push({
        namespace: namespace,
        type: 'DaemonSet',
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

  return { namespace, daemonSets }
}

function listDaemonSets (client, namespace) {
  return multiple(client, namespace).list()
}

async function patchDaemonSet (client, namespace, name, diff) {
  await single(client, namespace, name).patch(diff)
    .catch(err => {
      throw new Error(`DaemonSet '${namespace}.${name}' failed to patch:\n\t${err.message}`)
    })
  await checkDaemonSet(client, namespace, name, 'update')
}

async function replaceDaemonSet (client, namespace, name, spec) {
  await single(client, namespace, name).update(spec)
    .catch(err => {
      throw new Error(`DaemonSet '${namespace}.${name}' failed to replace:\n\t${err.message}`)
    })
  await checkDaemonSet(client, namespace, name, 'update')
}

async function updateDaemonSet (client, namespace, name, image, container) {
  const patch = diffs.getImagePatch(container || name, image)
  await single(client, namespace, name).patch(patch)
    .catch(err => {
      throw new Error(`DaemonSet '${namespace}.${name}' failed to upgrade:\n\t${err.message}`)
    })
  await checkDaemonSet(client, namespace, name, 'update')
}

module.exports = function (client, deletes) {
  return {
    create: createDaemonSet.bind(null, client, deletes),
    delete: deleteDaemonSet.bind(null, client),
    getByNamespace: getDaemonSetsByNamespace.bind(null, client),
    list: listDaemonSets.bind(null, client),
    replace: replaceDaemonSet.bind(null, client),
    update: updateDaemonSet.bind(null, client)
  }
}
