const log = require('bole')('k8s')
const Promise = require('bluebird')
const retry = require('../retry')

async function checkNamespace (client, namespace, outcome) {
  log.debug(`checking namespace status '${namespace}' for '${outcome}'`)
  return retry(async () => {
    try {
      var result = await client.namespace(namespace).get()
    } catch (err) {
      if (outcome === 'deletion') {
        log.debug(`namespace '${namespace}' deleted successfully`)
        return
      } else {
        log.debug(`namespace '${namespace}' status - resulted in API error. Checking again soon.`)
        throw new Error('namespace not ready yet')
      }
    }

    log.debug(`namespace '${namespace}' status - '${result.status.phase}'`)
    if (outcome === 'creation' && result.status.phase === 'Active') {
      return result
    } else if (outcome === 'deletion' && result.status.phase !== 'Terminating') {
      return result
    }
    throw new Error('namespace not ready yet')
  })
}

async function createNamespace (client, namespace) {
  const namespaceSpec = {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {
      name: namespace,
      labels: {
        name: namespace
      }
    }
  }

  try {
    var result = await getNamespace(client, namespace)
  } catch (err) {
    result = await client.namespaces.create(namespaceSpec)
      .catch(err => {
        throw new Error(`Namespace '${namespace}' failed to create:\n\t${err.message}`)
      })
  }
  return result
}

async function deleteNamespace (client, namespace) {
  try {
    await getNamespace(client, namespace)
  } catch (err) {
    return
  }
  await client.namespace(namespace).delete()
  await checkNamespace(client, namespace, 'deletion')
    .catch(err => {
      throw new Error(`Namespace '${namespace}' could not be deleted:\n\t${err.message}`)
    })
}

function getNamespace (client, namespace, image) {
  return client.namespace(namespace).get()
}

async function listNamespaces (client) {
  const list = await client.namespaces.list()
  return list.items.map(item => item.metadata.name)
}

async function fixNamespaceLabels (client) {
  const getUpdate = (namespace) => {
    return {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: namespace,
        labels: {
          name: namespace
        }
      }
    }
  }
  log.info('Checking existing namespaces for missing name labels')
  const list = await client.namespaces.list()
  return Promise.all(
    list.items.map(async item => {
      let name = item.metadata.name
      if (!item.metadata.labels || !item.metadata.labels.name || item.metadata.labels.name !== name) {
        log.info(`Adding name label to namespace ${name}`)
        return client.namespace(name).patch(getUpdate(name))
      }
    })
  )
}

module.exports = function (client) {
  return {
    create: createNamespace.bind(null, client),
    delete: deleteNamespace.bind(null, client),
    fixLabels: fixNamespaceLabels.bind(null, client),
    get: getNamespace.bind(null, client),
    list: listNamespaces.bind(null, client)
  }
}
