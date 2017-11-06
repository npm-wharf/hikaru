const _ = require('lodash')
const log = require('bole')('k8s')
const Promise = require('bluebird')
const diffs = require('./specDiff')
const pluralize = require('pluralize')

function base (client, manifest) {
  const namespace = manifest.metadata.namespace || 'default'
  return client
    .group(manifest.apiVersion)
    .ns(namespace)
}

function single (client, manifest) {
  const name = manifest.metadata.name
  const kind = manifest.kind.toLowerCase()
  console.log(name, kind)
  return base(client, manifest)[kind](name)
}

function multiple (client, manifest) {
  const kind = manifest.kind.toLowerCase()
  const plural = pluralize(kind, 2)
  return base(client, manifest)[plural]
}

function checkManifest (client, manifest, outcome, resolve, wait) {
  let ms = wait || 500
  let next = ms + (ms / 2)
  const namespace = manifest.metdata.namespace || 'default'
  const name = manifest.metdata.name
  log.debug(`checking service status '${namespace}.${name}' for '${outcome}'`)
  setTimeout(() => {
    single(client, manifest).get()
      .then(
        result => {
          log.debug(`service '${namespace}.${name}' status - '${JSON.stringify(result.status, null, 2)}'`)
          if (outcome === 'creation' && result.status.loadBalancer) {
            resolve(result)
          } else if (outcome === 'update' && result.status.loadBalancer) {
            resolve(result)
          } else {
            checkManifest(client, manifest, outcome, resolve, next)
          }
        },
        () => {
          if (outcome === 'deletion') {
            log.debug(`service '${namespace}.${name}' deleted successfully.`)
            resolve()
          } else {
            log.debug(`checking service '${namespace}.${name}' status - resulted in API error. Checking again in ${next} ms.`)
            checkManifest(client, manifest, outcome, resolve, next)
          }
        }
      )
  }, ms)
}

function createManifest (client, manifest) {
  const namespace = manifest.metadata.namespace || 'default'
  const name = manifest.metadata.name
  const kind = manifest.kind.toLowerCase()
  let create = (resolve, reject) =>
    multiple(client, manifest).create(manifest)
    .then(
      result => {
        checkManifest(client, manifest, namespace, name, 'creation', resolve)
      },
      err => {
        reject(new Error(`Manifest '${namespace}.${name}' failed to create:\n\t${err.message}`))
      }
    )
  return new Promise((resolve, reject) => {
    single(client, manifest).get()
      .then(
        loaded => {
          const diff = diffs.simple(loaded, manifest)
          if (_.isEmpty(diff)) {
            resolve()
          } else {
            if (diffs.canPatch(diff)) {
              if (client.saveDiffs) {
                diffs.save(loaded, manifest, diff)
              }
              updateManifest(client, manifest, diff)
                .then(
                  resolve,
                  reject
                )
            } else if (diffs.canReplace(diff)) {
              replaceManifest(client, manifest)
                .then(
                  resolve,
                  reject
                )
            } else {
              deleteManifest(client, manifest)
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

function deleteManifest (client, manifest) {
  const namespace = manifest.metadata.namespace || 'default'
  const name = manifest.metadata.name
  return new Promise((resolve, reject) => {
    single(client, manifest).get()
      .then(
        () => {
          single(client, manifest).delete()
            .then(
              result => {
                checkManifest(client, manifest, 'deletion', resolve)
              },
              err => {
                reject(new Error(`Manifest '${namespace}.${name}' could not be deleted:\n\t${err.message}`))
              }
            )
        },
        () => { resolve() }
      )
  })
}

function listManifests (client, apiVersion, kind) {
  const manifest = {
    apiVersion, kind
  }
  return multiple(client, manifest).list()
}

function replaceManifest (client, manifest) {
  const namespace = manifest.metadata.namespace || 'default'
  const name = manifest.metadata.name
  return new Promise((resolve, reject) => {
    single(client, manifest).update(manifest)
      .then(
        result => {
          checkManifest(client, manifest, 'update', resolve)
        },
        err => {
          reject(new Error(`Manifest '${namespace}.${name}' failed to replace:\n\t${err.message}`))
        }
      )
  })
}

function updateManifest (client, manifest, diff) {
  const namespace = manifest.metadata.namespace || 'default'
  const name = manifest.metadata.name
  return new Promise((resolve, reject) => {
    single(client, manifest).patch(diff)
      .then(
        result => {
          checkManifest(client, manifest, 'update', resolve)
        },
        err => {
          reject(new Error(`Manifest '${namespace}.${name}' failed to update:\n\t${err.message}`))
        }
      )
  })
}

module.exports = function (client) {
  return {
    create: createManifest.bind(null, client),
    delete: deleteManifest.bind(null, client),
    list: listManifests.bind(null, client),
    replace: replaceManifest.bind(null, client),
    update: updateManifest.bind(null, client)
  }
}
