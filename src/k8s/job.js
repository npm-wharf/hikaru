const _ = require('lodash')
const log = require('bole')('k8s')
const Promise = require('bluebird')
const diffs = require('./specDiff')

function base (client, namespace) {
  return client
      .group('batch')
      .ns(namespace)
}

function single (client, namespace, name) {
  return base(client, namespace).job(name)
}

function multiple (client, namespace, name) {
  return base(client, namespace).jobs
}

function checkJob (client, namespace, name, outcome, resolve, reject, wait) {
  let ms = wait || 500
  let next = ms + (ms / 2)
  setTimeout(() => {
    log.debug(`checking job status '${namespace}.${name}' for '${outcome}'`)
    single(client, namespace, name).get()
      .then(
        result => {
          try {
            log.debug(`job '${namespace}.${name}' status - '${JSON.stringify(result.status, null, 2)}'`)
            const status = result.status.conditions && result.status.conditions.length
                              ? result.status.conditions[0] : {}
            if (outcome === 'completion') {
              if (status.type === 'Complete' && status.status === 'True') {
                resolve(result)
              } else if (status.type === 'Failed' && status.status === 'True') {
                reject(new Error(`Job '${namespace}.${name}' failed to complete with status: '${JSON.stringify(result.status, null, 2)}'`))
              } else {
                checkJob(client, namespace, name, outcome, resolve, reject, next)
              }
            } else if (outcome === 'updated') {
              if (status.type === 'Complete' && status.status === 'True') {
                resolve(result)
              } else if (status.type === 'Failed' && status.status === 'True') {
                reject(new Error(`Job '${namespace}.${name}' failed to update with status: '${JSON.stringify(result.status, null, 2)}'`))
              } else {
                checkJob(client, namespace, name, outcome, resolve, reject, next)
              }
            } else {
              checkJob(client, namespace, name, outcome, resolve, reject, next)
            }
          } catch (e) {
            log.error(`error checking result '${JSON.stringify(result, null, 2)}':\n\t${e}`)
          }
        },
        () => {
          if (outcome === 'deletion') {
            log.debug(`job '${namespace}.${name}' deleted successfully.`)
            resolve()
          } else {
            log.debug(`job '${namespace}.${name}' status check got API error. Checking again in ${next} ms.`)
            checkJob(client, namespace, name, outcome, resolve, reject, next)
          }
        }
      )
  }, ms)
}

function createJob (client, jobSpec) {
  const namespace = jobSpec.metadata.namespace || 'default'
  const name = jobSpec.metadata.name
  let create = (resolve, reject) =>
    multiple(client, namespace).create(jobSpec)
    .then(
      result => {
        checkJob(client, namespace, name, 'completion', resolve, reject)
      },
      err => {
        reject(new Error(` Job '${namespace}.${name}' failed to create:\n\t${err.message}`))
      }
    )
  return new Promise((resolve, reject) => {
    single(client, namespace, name).get()
      .then(
        loaded => {
          const diff = diffs.simple(loaded, jobSpec)
          if (_.isEmpty(diff)) {
            resolve()
          } else {
            if (diffs.canPatch(diff, 'job') || diffs.isBackoffOnly(diff, jobSpec)) {
              if (client.saveDiffs) {
                diffs.save(loaded, jobSpec, diff)
              }
              updateJob(client, namespace, name, diff)
                .then(
                  resolve,
                  reject
                )
            } else if (diffs.canReplace(diff, 'job')) {
              replaceJob(client, namespace, name, jobSpec)
                .then(
                  resolve,
                  reject
                )
            } else {
              deleteJob(client, namespace, name)
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

function deleteJob (client, namespace, name) {
  return new Promise((resolve, reject) => {
    single(client, namespace, name).get()
      .then(
        () => {
          single(client, namespace, name).delete()
            .then(
              result => {
                checkJob(client, namespace, name, 'deletion', resolve)
              },
              err => {
                reject(new Error(`Job '${namespace}.${name}' could not be deleted:\n\t${err.message}`))
              }
            )
        },
        () => { resolve() }
      )
  })
}

function listJobs (client, namespace) {
  return multiple(client, namespace).list()
}

function replaceJob (client, namespace, name, spec) {
  return new Promise((resolve, reject) => {
    single(client, namespace, name).update(spec)
      .then(
        result => {
          checkJob(client, namespace, name, 'updated', resolve)
        },
        err => {
          reject(new Error(`Job '${namespace}.${name}' failed to replace:\n\t${err.message}`))
        }
      )
  })
}

function updateJob (client, namespace, name, diff) {
  return new Promise((resolve, reject) => {
    single(client, namespace, name).patch(diff)
      .then(
        result => {
          checkJob(client, namespace, name, 'updated', resolve)
        },
        err => {
          reject(new Error(`Job '${namespace}.${name}' failed to update:\n\t${err.message}`))
        }
      )
  })
}

module.exports = function (client) {
  return {
    create: createJob.bind(null, client),
    delete: deleteJob.bind(null, client),
    list: listJobs.bind(null, client),
    replace: replaceJob.bind(null, client),
    update: updateJob.bind(null, client)
  }
}
