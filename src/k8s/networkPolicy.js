const _ = require('lodash')
const core = require('./core')
const diffs = require('./specDiff')

const GROUPS = {
  '1.4': 'networking.k8s.io/v1',
  '1.5': 'networking.k8s.io/v1',
  '1.6': 'networking.k8s.io/v1',
  '1.7': 'networking.k8s.io/v1',
  '1.8': 'networking.k8s.io/v1',
  '1.9': 'networking.k8s.io/v1',
  '1.10': 'networking.k8s.io/v1',
  '1.11': 'networking.k8s.io/v1',
  '1.12': 'networking.k8s.io/v1',
  '1.13': 'networking.k8s.io/v1',
  '1.14': 'networking.k8s.io/v1',
  '1.15': 'networking.k8s.io/v1'
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
  return base(client, namespace).networkpolicy(name)
}

function multiple (client, namespace, name) {
  return base(client, namespace).networkpolicies
}

async function createNetworkPolicy (client, deletes, networkPolicy) {
  const namespace = networkPolicy.metadata.namespace || 'default'
  const name = networkPolicy.metadata.name

  let create = async () => {
    await multiple(client, namespace).create(networkPolicy)
      .catch(err => {
        throw new Error(`NetworkPolicy '${namespace}.${name}' failed to create:\n\t${err.message}`)
      })
  }

  try {
    var loaded = await single(client, namespace, name).get()
  } catch (err) {
    return create()
  }
  const diff = diffs.simple(loaded, networkPolicy)
  if (!_.isEmpty(diff)) {
    if (diffs.canPatch(diff)) {
      if (client.saveDiffs) {
        diffs.save(loaded, networkPolicy, diff)
      }
      await patchNetworkPolicy(client, namespace, name, diff)
    } else if (diffs.canReplace(diff)) {
      await replaceNetworkPolicy(client, namespace, name, networkPolicy)
    } else {
      await deleteNetworkPolicy(client, namespace, name)
      await create()
    }
  }
}

async function deleteNetworkPolicy (client, namespace, name) {
  try {
    await single(client, namespace, name).get()
  } catch (err) {
    return
  }
  await single(client, namespace, name).delete()
    .catch(err => {
      throw new Error(`NetworkPolicy '${namespace}.${name}' could not be deleted:\n\t${err.message}`)
    })
}

async function getNetworkPoliciesByNamespace (client, namespace, baseImage) {
  const list = await listNetworkPolicies(client, namespace)
  let networkPolicies = _.reduce(list.items, (acc, spec) => {
    const containers = core.getContainersFromSpec(spec, baseImage)
    containers.forEach(container => {
      acc.push({
        namespace: namespace,
        type: 'NetworkPolicy',
        service: spec.metadata.name,
        image: container.image,
        container: container.name,
        metadata: spec.metadata,
        labels: spec.template.metadata
          ? spec.template.metadata.labels
          : {}
      })
    })
    return acc
  }, [])
  return { namespace, networkPolicies }
}

async function listNetworkPolicies (client, namespace) {
  return multiple(client, namespace).list()
}

async function patchNetworkPolicy (client, namespace, name, diff) {
  await single(client, namespace, name).patch(diff)
    .catch(err => {
      throw new Error(`NetworkPolicy '${namespace}.${name}' failed to patch:\n\t${err.message}`)
    })
}

async function replaceNetworkPolicy (client, namespace, name, spec) {
  await single(client, namespace, name).update(spec)
    .catch(err => {
      throw new Error(`NetworkPolicy '${namespace}.${name}' failed to replace:\n\t${err.message}`)
    })
}

async function updateNetworkPolicy (client, namespace, name, image, container) {
  const patch = diffs.getImagePatch(container || name, image)
  await single(client, namespace, name).patch(patch)
    .catch(err => {
      throw new Error(`NetworkPolicy '${namespace}.${name}' failed to upgrade:\n\t${err.message}`)
    })
}

module.exports = function (client, deletes) {
  return {
    create: createNetworkPolicy.bind(null, client, deletes),
    delete: deleteNetworkPolicy.bind(null, client),
    getByNamespace: getNetworkPoliciesByNamespace.bind(null, client),
    list: listNetworkPolicies.bind(null, client),
    replace: replaceNetworkPolicy.bind(null, client),
    update: updateNetworkPolicy.bind(null, client)
  }
}
