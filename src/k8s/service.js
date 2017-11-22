const _ = require('lodash')
const log = require('bole')('k8s')
const Promise = require('bluebird')
const diffs = require('./specDiff')

function base (client, namespace) {
  return client
    .ns(namespace)
}

function single (client, namespace, name) {
  return base(client, namespace).service(name)
}

function multiple (client, namespace, name) {
  return base(client, namespace).services
}

function checkService (client, namespace, name, outcome, resolve, wait) {
  let ms = wait || 500
  let next = ms + (ms / 2)
  if (next > 5000) {
    next = 5000
  }
  log.debug(`checking service status '${namespace}.${name}' for '${outcome}'`)
  setTimeout(() => {
    single(client, namespace, name).get()
      .then(
        result => {
          log.debug(`service '${namespace}.${name}' status - '${JSON.stringify(result.status, null, 2)}'`)
          if (outcome === 'creation' && result.status.loadBalancer) {
            resolve(result)
          } else if (outcome === 'update' && result.status.loadBalancer) {
            resolve(result)
          } else {
            checkService(client, namespace, name, outcome, resolve, next)
          }
        },
        () => {
          if (outcome === 'deletion') {
            log.debug(`service '${namespace}.${name}' deleted successfully.`)
            resolve()
          } else {
            log.debug(`checking service '${namespace}.${name}' status - resulted in API error. Checking again in ${next} ms.`)
            checkService(client, namespace, name, outcome, resolve, next)
          }
        }
      )
  }, ms)
}

function createService (client, deletes, service) {
  const namespace = service.metadata.namespace || 'default'
  const name = service.metadata.name
  let create = (resolve, reject) =>
    multiple(client, namespace).create(service)
    .then(
      result => {
        checkService(client, namespace, name, 'creation', resolve)
      },
      err => {
        reject(new Error(`Service '${namespace}.${name}' failed to create:\n\t${err.message}`))
      }
    )
  return new Promise((resolve, reject) => {
    single(client, namespace, name).get()
      .then(
        loaded => {
          const diff = diffs.simple(loaded, service)
          if (_.isEmpty(diff)) {
            resolve()
          } else {
            if (diffs.canPatch(diff)) {
              if (client.saveDiffs) {
                diffs.save(loaded, service, diff)
              }
              updateService(client, namespace, name, diff)
                .then(
                  resolve,
                  reject
                )
            } else if (diffs.canReplace(diff)) {
              replaceService(client, namespace, name, service)
                .then(
                  resolve,
                  reject
                )
            } else {
              deleteService(client, namespace, name)
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

function deleteService (client, namespace, name) {
  return new Promise((resolve, reject) => {
    single(client, namespace, name).get()
      .then(
        () => {
          single(client, namespace, name).delete()
            .then(
              result => {
                checkService(client, namespace, name, 'deletion', resolve)
              },
              err => {
                reject(new Error(`Service '${namespace}.${name}' could not be deleted:\n\t${err.message}`))
              }
            )
        },
        () => { resolve() }
      )
  })
}

function listServices (client, namespace) {
  return multiple(client, namespace).list()
}

function replaceService (client, namespace, name, spec) {
  return new Promise((resolve, reject) => {
    single(client, namespace, name).update(spec)
      .then(
        result => {
          checkService(client, namespace, name, 'update', resolve)
        },
        err => {
          reject(new Error(`Service '${namespace}.${name}' failed to replace:\n\t${err.message}`))
        }
      )
  })
}

function updateService (client, namespace, name, diff) {
  return new Promise((resolve, reject) => {
    single(client, namespace, name).patch(diff)
      .then(
        result => {
          checkService(client, namespace, name, 'update', resolve)
        },
        err => {
          reject(new Error(`Service '${namespace}.${name}' failed to update:\n\t${err.message}`))
        }
      )
  })
}

module.exports = function (client, deletes) {
  return {
    create: createService.bind(null, client, deletes),
    delete: deleteService.bind(null, client),
    list: listServices.bind(null, client),
    replace: replaceService.bind(null, client),
    update: updateService.bind(null, client)
  }
}
