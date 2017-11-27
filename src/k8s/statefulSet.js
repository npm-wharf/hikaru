const _ = require('lodash')
const log = require('bole')('k8s')
const Promise = require('bluebird')
const core = require('./core')
const diffs = require('./specDiff')
const parse = require('../imageParser').parse

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

function checkStatefulSet (client, namespace, name, outcome, resolve, wait) {
  let ms = wait || 500
  let next = ms + (ms / 2)
  if (next > 5000) {
    next = 5000
  }
  log.debug(`checking statefulSet status '${namespace}.${name}' for '${outcome}'`)
  setTimeout(() => {
    single(client, namespace, name).get()
      .then(
        result => {
          log.debug(`statefulSet '${namespace}.${name}' status - '${JSON.stringify(result.status, null, 2)}'`)
          if (outcome === 'creation' && result.status.readyReplicas > 0) {
            resolve(result)
          } else if (outcome === 'updated' && result.status.readyReplicas > 0) {
            resolve(result)
          } else if (outcome === 'deletion' && result.status.phase !== 'Terminating') {
            resolve(result)
          } else {
            checkStatefulSet(client, namespace, name, outcome, resolve, next)
          }
        },
        () => {
          if (outcome === 'deletion') {
            log.debug(`statefulSet '${namespace}.${name}' deleted successfully.`)
            resolve()
          } else {
            log.debug(`statefulSet '${namespace}.${name}' status check got API error. Checking again in ${next} ms.`)
            checkStatefulSet(client, namespace, name, outcome, resolve, next)
          }
        }
      )
  }, ms)
}

function createStatefulSet (client, deletes, statefulSet) {
  const namespace = statefulSet.metadata.namespace || 'default'
  const name = statefulSet.metadata.name
  let create = (resolve, reject) =>
    multiple(client, namespace).create(statefulSet)
    .then(
      result => {
        checkStatefulSet(client, namespace, name, 'creation', resolve)
      },
      err => {
        reject(new Error(`StatefulSet '${namespace}.${name}' failed to create:\n\t${err.message}`))
      }
    )
  return new Promise((resolve, reject) => {
    single(client, namespace, name).get()
      .then(
        loaded => {
          const diff = diffs.simple(loaded, statefulSet)
          if (_.isEmpty(diff)) {
            resolve()
          } else {
            if (diffs.canPatch(diff)) {
              if (client.saveDiffs) {
                diffs.save(loaded, statefulSet, diff)
              }
              updateStatefulSet(client, namespace, name, diff)
                .then(
                  resolve,
                  reject
                )
            } else if (diffs.canReplace(diff)) {
              replaceStatefulSet(client, namespace, name, statefulSet)
                .then(
                  resolve,
                  reject
                )
            } else {
              deleteStatefulSet(client, namespace, name)
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

function deleteStatefulSet (client, namespace, name) {
  return new Promise((resolve, reject) => {
    single(client, namespace, name).get()
      .then(
        () => {
          single(client, namespace, name).delete()
            .then(
              result => {
                checkStatefulSet(client, namespace, name, 'deletion', resolve)
              },
              err => {
                reject(new Error(`StatefulSet '${namespace}.${name}' could not be deleted:\n\t${err.message}`))
              }
            )
        },
        () => { resolve() }
      )
  })
}

function getStatefulSetsByNamespace (client, namespace, baseImage) {
  return listStatefulSets(client, namespace)
      .then(
        list => {
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
                labels: spec.template.metadata
                  ? spec.template.metadata.labels
                  : {}
              })
            })
            return acc
          }, [])
          return { namespace, statefulSets }
        }
      )
}

function listStatefulSets (client, namespace) {
  return multiple(client, namespace).list()
}

function replaceStatefulSet (client, namespace, name, spec) {
  return new Promise((resolve, reject) => {
    single(client, namespace, name).update(spec)
      .then(
        result => {
          checkStatefulSet(client, namespace, name, 'updated', resolve)
        },
        err => {
          reject(new Error(`StatefulSet '${namespace}.${name}' failed to replace:\n\t${err.message}`))
        }
      )
  })
}

function updateStatefulSet (client, namespace, name, patch) {
  return new Promise((resolve, reject) => {
    single(client, namespace, name).patch(patch)
      .then(
        result => {
          checkStatefulSet(client, namespace, name, 'updated', resolve)
        },
        err => {
          reject(new Error(`StatefulSet '${namespace}.${name}' failed to update:\n\t${err.message}`))
        }
      )
  })
}

function upgradeStatefulSet (client, namespace, name, image, container) {
  const patch = diffs.getImagePatch(container || name, image)
  return new Promise((resolve, reject) => {
    single(client, namespace, name).patch(patch)
      .then(
        result => {
          checkStatefulSet(client, namespace, name, 'update', resolve)
        },
        err => {
          reject(new Error(`StatefulSet '${namespace}.${name}' failed to upgrade:\n\t${err.message}`))
        }
      )
  })
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
