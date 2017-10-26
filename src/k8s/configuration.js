const _ = require('lodash')
const diffs = require('./specDiff')

function base (client, namespace) {
  return client
    .ns(namespace)
}

function single (client, namespace, name) {
  return base(client, namespace).configmap(name)
}

function multiple (client, namespace, name) {
  return base(client, namespace).configmaps
}

function createConfiguration (client, configSpec) {
  const namespace = configSpec.metadata.namespace
  const name = configSpec.metadata.name
  let createNew = () => {
    return multiple(client, namespace).create(configSpec)
      .then(
        null,
        err => {
          throw new Error(`Configuration map '${namespace}.${name}' failed to create:\n\t${err.message}`)
        }
      )
  }

  return single(client, namespace, name).get()
    .then(
      loaded => {
        const diff = diffs.simple(loaded, configSpec)
        if (_.isEmpty(diff)) {
          return true
        } else {
          if (client.saveDiffs) {
            diffs.save(loaded, configSpec, diff)
          }
          return updateConfiguration(client, namespace, name, diff)
        }
      },
      createNew
    )
}

function deleteConfiguration (client, namespace, name) {
  return single(client, namespace, name).get()
    .then(
      () => {
        return single(client, namespace, name).delete()
      },
      () => { return true }
    )
}

function listConfigurations (client, namespace) {
  return multiple(client, namespace).list()
}

function replaceConfiguration (client, configSpec) {
  const namespace = configSpec.metadata.namespace
  const name = configSpec.metadata.name
  return single(client, namespace, name).replace(configSpec)
    .then(
      null,
      err => {
        throw new Error(`Configuration map '${namespace}.${name}' failed to replace:\n\t${err.message}`)
      }
    )
}

function updateConfiguration (client, namespace, name, diff) {
  return single(client, namespace, name).patch(diff)
    .then(
      null,
      err => {
        throw new Error(`Configuration map '${namespace}.${name}' failed to update:\n\t${err.message}`)
      }
    )
}

module.exports = function (client) {
  return {
    create: createConfiguration.bind(null, client),
    delete: deleteConfiguration.bind(null, client),
    list: listConfigurations.bind(null, client),
    replace: replaceConfiguration.bind(null, client),
    update: updateConfiguration.bind(null, client)
  }
}
