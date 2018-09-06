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

async function createAccount (client, accountSpec) {
  const namespace = accountSpec.metadata.namespace || 'default'
  const name = accountSpec.metadata.name

  try {
    var loaded = await single(client, namespace, name).get()
  } catch (e) {
    return multiple(client, namespace).create(accountSpec)
      .catch(err => {
        throw new Error(`Service account '${namespace}.${name}' failed to create:\n\t${err.message}`)
      })
  }

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
}

async function deleteAccount (client, namespace, name) {
  try {
    await client.ns(namespace).serviceaccount(name).get()
  } catch (e) {
    return true
  }
  return client.ns(namespace).serviceaccount(name).delete()
    .catch(err => {
      throw new Error(`Account '${namespace}.${name}' could not be deleted:\n\t${err.message}`)
    })
}

function listAccounts (client, namespace) {
  return multiple(client, namespace).list()
}

function replaceAccount (client, namespace, name, spec) {
  return single(client, namespace, name).update(spec)
    .catch(
      err => {
        throw new Error(`Account '${namespace}.${name}' failed to replace:\n\t${err.message}`)
      }
    )
}

function updateAccount (client, namespace, name, diff) {
  return single(client, namespace, name).patch(diff)
    .catch(
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
