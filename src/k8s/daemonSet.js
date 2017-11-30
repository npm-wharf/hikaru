const _ = require('lodash')
const log = require('bole')('k8s')
const Promise = require('bluebird')
const core = require('./core')
const diffs = require('./specDiff')
const parse = require('../imageParser').parse

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

function checkDaemonSet (client, namespace, name, outcome, resolve, wait) {
  let ms = wait || 500
  let next = ms + (ms / 2)
  if (next > 5000) {
    next = 5000
  }
  setTimeout(() => {
    log.debug(`checking daemonSet status '${namespace}.${name}' for '${outcome}'`)
    single(client, namespace, name).get()
      .then(
        result => {
          log.debug(`daemonSet '${namespace}.${name}' status - '${JSON.stringify(result.status, null, 2)}'`)
          if ((outcome === 'creation' || outcome === 'update') && result.status.numberReady === result.status.desiredNumberScheduled) {
            resolve(result)
          } else if (outcome === 'deletion' && result.status.phase !== 'Terminating') {
            resolve(result)
          } else {
            checkDaemonSet(client, namespace, name, outcome, resolve, next)
          }
        },
        () => {
          if (outcome === 'deletion') {
            log.debug(`daemonSet '${namespace}.${name}' deleted successfully.`)
            resolve()
          } else {
            log.debug(`daemonSet '${namespace}.${name}' status check got API error. Checking again in ${next} ms.`)
            checkDaemonSet(client, namespace, name, outcome, resolve, next)
          }
        }
      )
  }, ms)
}

function createDaemonSet (client, deletes, daemonSet) {
  const namespace = daemonSet.metadata.namespace || 'default'
  const name = daemonSet.metadata.name

  let create = (resolve, reject) =>
    multiple(client, namespace).create(daemonSet)
    .then(
      result => {
        checkDaemonSet(client, namespace, name, 'creation', resolve)
      },
      err => {
        reject(new Error(`DaemonSet '${namespace}.${name}' failed to create:\n\t${err.message}`))
      }
    )

  return new Promise((resolve, reject) => {
    single(client, namespace, name).get()
      .then(
        loaded => {
          const diff = diffs.simple(loaded, daemonSet)
          if (_.isEmpty(diff)) {
            resolve()
          } else {
            if (diffs.canPatch(diff)) {
              if (client.saveDiffs) {
                diffs.save(loaded, daemonSet, diff)
              }
              patchDaemonSet(client, namespace, name, diff)
                .then(
                  resolve,
                  reject
                )
            } else if (diffs.canReplace(diff)) {
              replaceDaemonSet(client, namespace, name, daemonSet)
                .then(
                  resolve,
                  reject
                )
            } else {
              deleteDaemonSet(client, namespace, name)
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

function deleteDaemonSet (client, namespace, name) {
  return new Promise((resolve, reject) => {
    single(client, namespace, name).get()
      .then(
        () => {
          single(client, namespace, name).delete()
            .then(
              result => {
                checkDaemonSet(client, namespace, name, 'deletion', resolve)
              },
              err => {
                reject(new Error(`DaemonSet '${namespace}.${name}' could not be deleted:\n\t${err.message}`))
              }
            )
        },
        () => {
          resolve()
        }
      )
  })
}

function getDaemonSetsByNamespace (client, namespace, baseImage) {
  return listDaemonSets(client, namespace)
      .then(
        list => {
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
                labels: spec.template.metadata
                  ? spec.template.metadata.labels
                  : {}
              })
            })
            return acc
          }, [])
          return { namespace, daemonSets }
        }
      )
}

function listDaemonSets (client, namespace) {
  return multiple(client, namespace).list()
}

function patchDaemonSet (client, namespace, name, diff) {
  return new Promise((resolve, reject) => {
    single(client, namespace, name).patch(diff)
      .then(
        result => {
          checkDaemonSet(client, namespace, name, 'update', resolve)
        },
        err => {
          reject(new Error(`DaemonSet '${namespace}.${name}' failed to patch:\n\t${err.message}`))
        }
      )
  })
}

function replaceDaemonSet (client, namespace, name, spec) {
  return new Promise((resolve, reject) => {
    single(client, namespace, name).update(spec)
      .then(
        result => {
          checkDaemonSet(client, namespace, name, 'update', resolve)
        },
        err => {
          reject(new Error(`DaemonSet '${namespace}.${name}' failed to replace:\n\t${err.message}`))
        }
      )
  })
}

function updateDaemonSet (client, namespace, name, image, container) {
  const patch = diffs.getImagePatch(container || name, image)
  return new Promise((resolve, reject) => {
    single(client, namespace, name).patch(patch)
      .then(
        result => {
          checkDaemonSet(client, namespace, name, 'update', resolve)
        },
        err => {
          reject(new Error(`DaemonSet '${namespace}.${name}' failed to upgrade:\n\t${err.message}`))
        }
      )
  })
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
