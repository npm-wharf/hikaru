const _ = require('lodash')
const log = require('bole')('k8s')
const diffs = require('./specDiff')

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const GROUPS = {
  '1.7': 'batch/v2alpha1',
  '1.8': 'batch/v1beta1'
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
  return base(client, namespace).cronjob(name)
}

function multiple (client, namespace) {
  return base(client, namespace).cronjobs
}

async function checkCronJob (client, namespace, name, outcome, wait = 500) {
  let tries = 0
  do {
    await delay(wait)
    wait *= 1.5
    if (wait > 5000) {
      wait = 5000
    }
    tries++

    log.debug(`checking cron job status '${namespace}.${name}' for '${outcome}'`)
    try {
      var result = await single(client, namespace, name).get()
    } catch (err) {
      if (outcome === 'deletion') {
        log.debug(`cron job '${namespace}.${name}' deleted successfully.`)
        return result
      } else {
        log.debug(`cron job '${namespace}.${name}' status check got API error. Checking again in ${wait} ms.`)
        continue
      }
    }

    try {
      log.debug(`cron job '${namespace}.${name}' status - '${JSON.stringify(result.status, null, 2)}'`)
      const status = result.status.conditions && result.status.conditions.length
                        ? result.status.conditions[0] : {}
      if (outcome === 'completion') {
        if (result.status === undefined || Object.keys(result.status).length === 0) {
          log.info(`cron job appears to have created successfully but did not run (according to schedule)`)
          return result
        } else if (status.type === 'Complete' && status.status === 'True') {
          return result
        } else if (status.type === 'Failed' && status.status === 'True') {
          throw new Error(`CronJob '${namespace}.${name}' failed to complete with status: '${JSON.stringify(result.status, null, 2)}'`)
        }
      } else if (outcome === 'updated') {
        if (result.status === undefined || Object.keys(result.status).length === 0) {
          log.info(`cron job appears to have updated successfully but did not run (according to schedule)`)
          return result
        } else if (status.type === 'Complete' && status.status === 'True') {
          return result
        } else if (status.type === 'Failed' && status.status === 'True') {
          throw new Error(`CronJob '${namespace}.${name}' failed to update with status: '${JSON.stringify(result.status, null, 2)}'`)
        }
      }
    } catch (e) {
      log.error(`error checking result '${JSON.stringify(result, null, 2)}':\n\t${e}`)
    }
  } while (tries < 20)
}

async function createCronJob (client, deletes, jobSpec) {
  const namespace = jobSpec.metadata.namespace || 'default'
  const name = jobSpec.metadata.name

  const create = async () => {
    await multiple(client, namespace).create(jobSpec)
      .catch(err => {
        throw new Error(`Cron Job '${namespace}.${name}' failed to create:\n\t${err.message}`)
      })
    await checkCronJob(client, namespace, name, 'completion')
  }

  try {
    var loaded = await single(client, namespace, name).get()
  } catch (err) {
    return create()
  }

  const diff = diffs.simple(loaded, jobSpec)
  if (!_.isEmpty(diff)) {
    if (diffs.canPatch(diff, 'job') || diffs.isBackoffOnly(diff, jobSpec)) {
      if (client.saveDiffs) {
        diffs.save(loaded, jobSpec, diff)
      }
      return updateCronJob(client, namespace, name, diff)
    } else if (diffs.canReplace(diff, 'job')) {
      return replaceCronJob(client, namespace, name, jobSpec)
    } else {
      await deleteCronJob(client, namespace, name)
      return create()
    }
  }
}

async function deleteCronJob (client, namespace, name) {
  try {
    await single(client, namespace, name).get()
  } catch (err) {
    return
  }
  single(client, namespace, name).delete()
    .catch(err => {
      throw new Error(`Job '${namespace}.${name}' could not be deleted:\n\t${err.message}`)
    })
  await checkCronJob(client, namespace, name, 'deletion')
}

async function listCronJobs (client, namespace) {
  return multiple(client, namespace).list()
}

async function replaceCronJob (client, namespace, name, spec) {
  await single(client, namespace, name).update(spec)
    .catch(err => {
      throw new Error(`CronJob '${namespace}.${name}' failed to replace:\n\t${err.message}`)
    })
  await checkCronJob(client, namespace, name, 'updated')
}

async function updateCronJob (client, namespace, name, diff) {
  await single(client, namespace, name).patch(diff)
    .catch(err => {
      throw new Error(`CronJob '${namespace}.${name}' failed to update:\n\t${err.message}`)
    })
  await checkCronJob(client, namespace, name, 'updated')
}

module.exports = function (client, deletes) {
  return {
    create: createCronJob.bind(null, client, deletes),
    delete: deleteCronJob.bind(null, client),
    list: listCronJobs.bind(null, client),
    replace: replaceCronJob.bind(null, client),
    update: updateCronJob.bind(null, client)
  }
}
