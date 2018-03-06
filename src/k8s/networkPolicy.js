const _ = require('lodash')
const Promise = require('bluebird')
const core = require('./core')
const diffs = require('./specDiff')

const GROUPS = {
  '1.4': 'networking.k8s.io/v1',
  '1.5': 'networking.k8s.io/v1',
  '1.6': 'networking.k8s.io/v1',
  '1.7': 'networking.k8s.io/v1',
  '1.8': 'networking.k8s.io/v1'
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

function createNetworkPolicy (client, deletes, networkPolicy) {
  const namespace = networkPolicy.metadata.namespace || 'default'
  const name = networkPolicy.metadata.name

  let create = (resolve, reject) =>
    multiple(client, namespace).create(networkPolicy)
    .then(
      () => resolve(),
      err => {
        reject(new Error(`NetworkPolicy '${namespace}.${name}' failed to create:\n\t${err.message}`))
      }
    )

  return new Promise((resolve, reject) => {
    single(client, namespace, name).get()
      .then(
        loaded => {
          const diff = diffs.simple(loaded, networkPolicy)
          if (_.isEmpty(diff)) {
            resolve()
          } else {
            if (diffs.canPatch(diff)) {
              if (client.saveDiffs) {
                diffs.save(loaded, networkPolicy, diff)
              }
              patchNetworkPolicy(client, namespace, name, diff)
                .then(
                  resolve,
                  reject
                )
            } else if (diffs.canReplace(diff)) {
              replaceNetworkPolicy(client, namespace, name, networkPolicy)
                .then(
                  resolve,
                  reject
                )
            } else {
              deleteNetworkPolicy(client, namespace, name)
                .then(
                  create.bind(null, resolve, reject),
                  reject
                )
            }
          }
        },
        create.bind(null, resolve, reject)
      )
  })
}

function deleteNetworkPolicy (client, namespace, name) {
  return new Promise((resolve, reject) => {
    single(client, namespace, name).get()
      .then(
        () => {
          single(client, namespace, name).delete()
            .then(
              () => resolve(),
              err => {
                reject(new Error(`NetworkPolicy '${namespace}.${name}' could not be deleted:\n\t${err.message}`))
              }
            )
        },
        () => {
          resolve()
        }
      )
  })
}

function getNetworkPoliciesByNamespace (client, namespace, baseImage) {
  return listNetworkPolicies(client, namespace)
      .then(
        list => {
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
      )
}

function listNetworkPolicies (client, namespace) {
  return multiple(client, namespace).list()
}

function patchNetworkPolicy (client, namespace, name, diff) {
  return new Promise((resolve, reject) => {
    single(client, namespace, name).patch(diff)
      .then(
        () => resolve(),
        err => {
          reject(new Error(`NetworkPolicy '${namespace}.${name}' failed to patch:\n\t${err.message}`))
        }
      )
  })
}

function replaceNetworkPolicy (client, namespace, name, spec) {
  return new Promise((resolve, reject) => {
    single(client, namespace, name).update(spec)
      .then(
        () => resolve(),
        err => {
          reject(new Error(`NetworkPolicy '${namespace}.${name}' failed to replace:\n\t${err.message}`))
        }
      )
  })
}

function updateNetworkPolicy (client, namespace, name, image, container) {
  const patch = diffs.getImagePatch(container || name, image)
  return new Promise((resolve, reject) => {
    single(client, namespace, name).patch(patch)
      .then(
        () => resolve(),
        err => {
          reject(new Error(`NetworkPolicy '${namespace}.${name}' failed to upgrade:\n\t${err.message}`))
        }
      )
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
