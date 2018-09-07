const _ = require('lodash')
const log = require('bole')('k8s')
const diffs = require('./specDiff')
const retry = require('../retry')

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

async function checkService (client, namespace, name, outcome) {
  await retry(async () => {
    log.debug(`checking service status '${namespace}.${name}' for '${outcome}'`)
    try {
      var result = await single(client, namespace, name).get()
    } catch (err) {
      if (outcome === 'deletion') {
        log.debug(`service '${namespace}.${name}' deleted successfully.`)
        return
      } else {
        log.debug(`checking service '${namespace}.${name}' status - resulted in API error. Checking again soon.`)
        throw new Error('continue')
      }
    }

    log.debug(`service '${namespace}.${name}' status - '${JSON.stringify(result.status, null, 2)}'`)
    if (outcome === 'creation' && result.status.loadBalancer) {
      return result
    } else if (outcome === 'update' && result.status.loadBalancer) {
      return result
    }
    throw new Error('continue')
  })
}

async function createService (client, deletes, service) {
  const namespace = service.metadata.namespace || 'default'
  const name = service.metadata.name
  let create = async () => {
    await multiple(client, namespace).create(service)
      .catch(err => {
        throw new Error(`Service '${namespace}.${name}' failed to create:\n\t${err.message}`)
      })

    await checkService(client, namespace, name, 'creation')
  }

  try {
    var loaded = await single(client, namespace, name).get()
  } catch (e) {
    await create()
    return
  }
  const diff = diffs.simple(loaded, service)
  if (!_.isEmpty(diff)) {
    if (diffs.canPatch(diff)) {
      if (client.saveDiffs) {
        diffs.save(loaded, service, diff)
      }
      await updateService(client, namespace, name, diff)
    } else if (diffs.canReplace(diff)) {
      await replaceService(client, namespace, name, service)
    } else {
      await deleteService(client, namespace, name)
      await create()
    }
  }
}

async function deleteService (client, namespace, name) {
  try {
    single(client, namespace, name).get()
  } catch (e) {
    return
  }
  await single(client, namespace, name).delete()
    .catch(err => {
      throw new Error(`Service '${namespace}.${name}' could not be deleted:\n\t${err.message}`)
    })
  await checkService(client, namespace, name, 'deletion')
}

function listServices (client, namespace) {
  return multiple(client, namespace).list()
}

async function replaceService (client, namespace, name, spec) {
  await single(client, namespace, name).update(spec)
    .catch(err => {
      throw new Error(`Service '${namespace}.${name}' failed to replace:\n\t${err.message}`)
    })

  await checkService(client, namespace, name, 'update')
}

async function updateService (client, namespace, name, diff) {
  await single(client, namespace, name).patch(diff)
    .catch(err => {
      throw new Error(`Service '${namespace}.${name}' failed to update:\n\t${err.message}`)
    })

  await checkService(client, namespace, name, 'update')
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
