const _ = require('lodash')
const diffs = require('./specDiff')

function base (client, namespace) {
  return client
    .ns(namespace)
}

function single (client, namespace, name) {
  return base(client, namespace).serviceaccount(name)
}

function multiple (client, namespace, name) {
  return base(client, namespace).serviceaccounts
}

function createAccount (client, accountSpec) {
  const namespace = accountSpec.metadata.namespace || 'default'
  const name = accountSpec.metadata.name
  let createNew = () => {
    return multiple(client, namespace).create(accountSpec)
      .then(
        null,
        err => {
          throw new Error(`Service account '${accountSpec.metadata.namespace}.${accountSpec.metadata.name}' failed to create:\n\t${err.message}`)
        }
      )
  }

  return single(client, namespace, name).get()
    .then(
      loaded => {
        const diff = diffs.simple(loaded, accountSpec)
        if (_.isEmpty(diff)) {
          return true
        } else {
          if (diffs.canPatch(diff)) {
            if (client.saveDiffs) {
              diffs.save(loaded, accountSpec, diff)
            }
            return updateAccount(client, namespace, name, diff)
          } else {
            return replaceAccount(client, namespace, name, diff)
          }
        }
      },
      createNew
    )
}

function deleteAccount (client, namespace, name) {
  return client.ns(namespace).serviceaccount(name).get()
    .then(
      () => {
        return client.ns(namespace).serviceaccount(name).delete()
          .then(
            null,
            err => {
              throw new Error(`Account '${namespace}.${name}' could not be deleted:\n\t${err.message}`)
            }
          )
      },
     () => { return true }
    )
}

function listAccounts (client, namespace) {
  return multiple(client, namespace).list()
}

function replaceAccount (client, namespace, name, spec) {
  return single(client, namespace, name).update(spec)
    .then(
      null,
      err => {
        throw new Error(`Account '${namespace}.${name}' failed to replace:\n\t${err.message}`)
      }
    )
}

function updateAccount (client, namespace, name, diff) {
  return single(client, namespace, name).patch(diff)
    .then(
      null,
      err => {
        throw new Error(`Account '${namespace}.${name}' failed to update:\n\t${err.message}`)
      }
    )
}

module.exports = function (client) {
  return {
    create: createAccount.bind(null, client),
    delete: deleteAccount.bind(null, client),
    list: listAccounts.bind(null, client),
    replace: replaceAccount.bind(null, client),
    update: updateAccount.bind(null, client)
  }
}
