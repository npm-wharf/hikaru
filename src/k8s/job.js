const _ = require('lodash')
const log = require('bole')('k8s')
const diffs = require('./specDiff')
const retry = require('../retry')

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

async function checkJob (client, namespace, name, outcome) {
  await retry(async bail => {
    log.debug(`checking job status '${namespace}.${name}' for '${outcome}'`)
    try {
      var result = await single(client, namespace, name).get()
    } catch (err) {
      if (outcome === 'deletion') {
        log.debug(`job '${namespace}.${name}' deleted successfully.`)
        return
      } else {
        log.debug(`job '${namespace}.${name}' status check got API error. Checking again soon.`)
        throw new Error('continue')
      }
    }

    try {
      log.debug(`job '${namespace}.${name}' status - '${JSON.stringify(result.status, null, 2)}'`)
      const status = result.status.conditions && result.status.conditions.length
                        ? result.status.conditions[0] : {}
      if (outcome === 'completion') {
        if (status.type === 'Complete' && status.status === 'True') {
          return result
        } else if (status.type === 'Failed' && status.status === 'True') {
          bail(new Error(`Job '${namespace}.${name}' failed to complete with status: '${JSON.stringify(result.status, null, 2)}'`))
        }
      } else if (outcome === 'updated') {
        if (status.type === 'Complete' && status.status === 'True') {
          return result
        } else if (status.type === 'Failed' && status.status === 'True') {
          bail(new Error(`Job '${namespace}.${name}' failed to update with status: '${JSON.stringify(result.status, null, 2)}'`))
        }
      }
    } catch (e) {
      log.error(`error checking result '${JSON.stringify(result, null, 2)}':\n\t${e}`)
    }
    throw new Error('continue')
  })
}

async function createJob (client, deletes, jobSpec) {
  const namespace = jobSpec.metadata.namespace || 'default'
  const name = jobSpec.metadata.name
  let create = async () => {
    await multiple(client, namespace).create(jobSpec)
      .catch(err => {
        throw new Error(` Job '${namespace}.${name}' failed to create:\n\t${err.message}`)
      })
    await checkJob(client, namespace, name, 'completion')
  }
  try {
    var loaded = await single(client, namespace, name).get()
  } catch (err) {
    await create()
  }
  const diff = diffs.simple(loaded, jobSpec)
  if (!_.isEmpty(diff)) {
    if (diffs.canPatch(diff, 'job') || diffs.isBackoffOnly(diff, jobSpec)) {
      if (client.saveDiffs) {
        diffs.save(loaded, jobSpec, diff)
      }
      await updateJob(client, namespace, name, diff)
    } else if (diffs.canReplace(diff, 'job')) {
      await replaceJob(client, namespace, name, jobSpec)
    } else {
      await deleteJob(client, namespace, name)
      await create()
    }
  }
}

async function deleteJob (client, namespace, name) {
  try {
    await single(client, namespace, name).get()
    await single(client, namespace, name).delete()
      .catch(err => {
        throw new Error(`Job '${namespace}.${name}' could not be deleted:\n\t${err.message}`)
      })
    await checkJob(client, namespace, name, 'deletion')
  } catch (err) {}
}

function listJobs (client, namespace) {
  return multiple(client, namespace).list()
}

async function replaceJob (client, namespace, name, spec) {
  await single(client, namespace, name).update(spec)
    .catch(err => {
      throw new Error(`Job '${namespace}.${name}' failed to replace:\n\t${err.message}`)
    })
  await checkJob(client, namespace, name, 'updated')
}

async function runJob (client, deletes, namespace, name, spec) {
  try {
    await deleteJob(client, namespace, name)
    await createJob(client, deletes, spec)
  } catch (err) {
    log.error(`running job '${name}' in namespace '${namespace}' failed with: ${err.stack}`)
    throw new Error(`running job '${name}' in namespace '${namespace}' failed`)
  }
  log.info(`job '${name}' in namespace '${namespace}' completed successfully`)
}

async function updateJob (client, namespace, name, diff) {
  await single(client, namespace, name).patch(diff)
    .catch(err => {
      throw new Error(`Job '${namespace}.${name}' failed to update:\n\t${err.message}`)
    })
  await checkJob(client, namespace, name, 'updated')
}

module.exports = function (client, deletes) {
  return {
    create: createJob.bind(null, client, deletes),
    delete: deleteJob.bind(null, client),
    list: listJobs.bind(null, client),
    replace: replaceJob.bind(null, client),
    run: runJob.bind(null, client, deletes),
    update: updateJob.bind(null, client)
  }
}
