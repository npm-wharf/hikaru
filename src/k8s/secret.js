const _ = require('lodash')
const diffs = require('./specDiff')

function base (client, namespace) {
  return client
    .ns(namespace)
}

function single (client, namespace, name) {
  return base(client, namespace).secret(name)
}

function multiple (client, namespace) {
  return base(client, namespace).secrets
}

function createSecret (client, configSpec) {
  const namespace = configSpec.metadata.namespace
  const name = configSpec.metadata.name
  let createNew = () => {
    return multiple(client, namespace).create(configSpec)
      .then(
        null,
        err => {
          throw new Error(`Secret map '${namespace}.${name}' failed to create:\n\t${err.message}`)
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
          return updateSecret(client, namespace, name, diff)
        }
      },
      createNew
    )
}

function deleteSecret (client, namespace, name) {
  return single(client, namespace, name).get()
    .then(
      () => {
        return single(client, namespace, name).delete()
      },
      () => { return true }
    )
}

function listSecrets (client, namespace) {
  return multiple(client, namespace).list()
}

function replaceSecret (client, configSpec) {
  const namespace = configSpec.metadata.namespace
  const name = configSpec.metadata.name
  return single(client, namespace, name).replace(configSpec)
    .then(
      null,
      err => {
        throw new Error(`Secret '${namespace}.${name}' failed to replace:\n\t${err.message}`)
      }
    )
}

function updateSecret (client, namespace, name, diff) {
  return single(client, namespace, name).patch(diff)
    .then(
      null,
      err => {
        throw new Error(`Secret '${namespace}.${name}' failed to update:\n\t${err.message}`)
      }
    )
}

module.exports = function (client) {
  return {
    create: createSecret.bind(null, client),
    delete: deleteSecret.bind(null, client),
    list: listSecrets.bind(null, client),
    replace: replaceSecret.bind(null, client),
    update: updateSecret.bind(null, client)
  }
}
