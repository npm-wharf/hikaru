const log = require('bole')('k8s')
const Promise = require('bluebird')

function checkNamespace (client, namespace, outcome, resolve, wait) {
  let ms = wait || 250
  let next = ms + (ms / 2)
  log.debug(`checking namespace status '${namespace}' for '${outcome}'`)
  setTimeout(() => {
    client.namespace(namespace).get()
      .then(
        result => {
          log.debug(`namespace '${namespace}' status - '${result.status.phase}'`)
          if (outcome === 'creation' && result.status.phase === 'Active') {
            resolve(result)
          } else if (outcome === 'deletion' && result.status.phase !== 'Terminating') {
            resolve(result)
          } else {
            checkNamespace(client, namespace, outcome, resolve, next)
          }
        },
        () => {
          if (outcome === 'deletion') {
            log.debug(`namespace '${namespace}' deleted successfully`)
            resolve()
          } else {
            log.debug(`namespace '${namespace}' status - resulted in API error. Checking again in ${next} ms.`)
            checkNamespace(client, namespace, outcome, resolve, next)
          }
        }
      )
  }, ms)
}

function createNamespace (client, namespace) {
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
  return getNamespace(client, namespace)
    .then(
      result => result,
      () => client
        .namespaces
        .create(namespaceSpec)
        .then(
          null,
          err => {
            throw new Error(`Namespace '${namespace}' failed to create:\n\t${err.message}`)
          }
        )
    )
}

function deleteNamespace (client, namespace) {
  return new Promise((resolve, reject) => {
    return getNamespace(client, namespace)
      .then(
        () => {
          client.namespace(namespace).delete()
            .then(
              result =>
                checkNamespace(client, namespace, 'deletion', resolve),
              err => reject(new Error(`Namespace '${namespace}' could not be deleted:\n\t${err.message}`))
            )
        },
        () => { resolve() }
      )
  })
}

function getNamespace (client, namespace, image) {
  return client.namespace(namespace).get()
}

function listNamespaces (client) {
  return client
    .namespaces
    .list()
    .then(
      list => list.items.map(item => item.metadata.name)
    )
}

function fixNamespaceLabels (client) {
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
  return client
    .namespaces
    .list()
    .then(
      list => Promise.all(
        list.items.map(item => {
          let name = item.metadata.name
          if (!item.metadata.labels || !item.metadata.labels.name || item.metadata.labels.name !== name) {
            log.info(`Adding name label to namespace ${name}`)
            return client.namespace(name).patch(getUpdate(name))
          } else {
            return Promise.resolve()
          }
        })
      )
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
