const _ = require('lodash')
const log = require('bole')('k8s')
const diffs = require('./specDiff')
const pluralize = require('pluralize')
const retry = require('../retry')

function base (client, manifest) {
  const namespace = manifest.metadata.namespace || 'default'
  if (/^ClusterRole/.test(manifest.kind)) {
    return client
      .group(manifest.apiVersion)
  }
  return client
    .group(manifest.apiVersion)
    .ns(namespace)
}

function single (client, manifest) {
  const name = manifest.metadata.name
  const kind = manifest.kind.toLowerCase()
  return base(client, manifest)[kind](name)
}

function multiple (client, manifest) {
  const kind = manifest.kind.toLowerCase()
  const plural = pluralize(kind, 2)
  return base(client, manifest)[plural]
}

async function checkManifest (client, manifest, outcome, resolve, limit, wait) {
  const namespace = manifest.metadata.namespace || 'default'
  const name = manifest.metadata.name

  return retry(async () => {
    log.debug(`checking service status '${namespace}.${name}' for '${outcome}'`)
    try {
      var result = await single(client, manifest).get()
    } catch (err) {
      if (outcome === 'deletion') {
        log.debug(`service '${namespace}.${name}' deleted successfully.`)
        return
      } else {
        log.debug(`checking service '${namespace}.${name}' status - resulted in API error. Checking again soon.`)
        throw new Error('continue')
      }
    }
    log.debug(`service '${namespace}.${name}' status - '${JSON.stringify(result, null, 2)}'`)
    if (outcome === 'creation' && result.status) {
      return result
    } else if (outcome === 'update' && result.status) {
      return result
    } else if (limit <= 0) {
      return result
    }
    throw new Error('continue')
  })
}

async function createManifest (client, manifest) {
  const namespace = manifest.metadata.namespace || 'default'
  const name = manifest.metadata.name
  let create = async () => {
    await multiple(client, manifest).create(manifest)
      .catch(err => {
        throw new Error(`Manifest '${namespace}.${name}' failed to create:\n\t${err.message}`)
      })
    await checkManifest(client, manifest, 'creation')
  }

  try {
    var loaded = await single(client, manifest).get()
  } catch (err) {
    await create()
    return
  }
  const diff = diffs.simple(loaded, manifest)
  if (!_.isEmpty(diff)) {
    if (diffs.canPatch(diff)) {
      if (client.saveDiffs) {
        diffs.save(loaded, manifest, diff)
      }
      await updateManifest(client, manifest, diff)
    } else if (diffs.canReplace(diff)) {
      await replaceManifest(client, manifest)
    } else {
      await deleteManifest(client, manifest)
    }
  }
}

async function deleteManifest (client, manifest) {
  const namespace = manifest.metadata.namespace || 'default'
  const name = manifest.metadata.name
  try {
    await single(client, manifest).get()
  } catch (err) {
    return
  }

  await single(client, manifest).delete()
    .catch(err => {
      throw new Error(`Manifest '${namespace}.${name}' could not be deleted:\n\t${err.message}`)
    })
  await checkManifest(client, manifest, 'deletion')
}

function listManifests (client, apiVersion, kind) {
  const manifest = {
    apiVersion, kind
  }
  return multiple(client, manifest).list()
}

async function replaceManifest (client, manifest) {
  const namespace = manifest.metadata.namespace || 'default'
  const name = manifest.metadata.name
  await single(client, manifest).update(manifest)
    .catch(err => {
      throw new Error(`Manifest '${namespace}.${name}' failed to replace:\n\t${err.message}`)
    })
  await checkManifest(client, manifest, 'update')
}

async function updateManifest (client, manifest, diff) {
  const namespace = manifest.metadata.namespace || 'default'
  const name = manifest.metadata.name
  await single(client, manifest).patch(diff)
    .catch(err => {
      throw new Error(`Manifest '${namespace}.${name}' failed to update:\n\t${err.message}`)
    })
  await checkManifest(client, manifest, 'update')
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
