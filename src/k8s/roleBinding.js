const Promise = require('bluebird')
const join = Promise.join

const GROUPS = {
  '1.6': 'rbac.authorization.k8s.io/v1beta1',
  '1.7': 'rbac.authorization.k8s.io/v1beta1',
  '1.8': 'rbac.authorization.k8s.io/v1',
  '1.9': 'rbac.authorization.k8s.io/v1',
  '1.10': 'rbac.authorization.k8s.io/v1',
  '1.11': 'rbac.authorization.k8s.io/v1',
  '1.12': 'rbac.authorization.k8s.io/v1'
}

function group (client) {
  return GROUPS[client.version]
}

function base (client, namespace) {
  if (namespace) {
    return client
      .group(group(client))
      .ns(namespace)
  } else {
    return client
      .group(group(client))
  }
}

function single (client, name, namespace) {
  if (namespace) {
    return base(client, namespace)
      .rolebinding(name)
  } else {
    return base(client)
      .clusterrolebinding(name)
  }
}

function multiple (client, namespace) {
  if (namespace) {
    return base(client, namespace)
      .rolebindings
  } else {
    return base(client)
      .clusterrolebindings
  }
}

async function createRoleBinding (client, roleBinding) {
  const namespace = roleBinding.metadata.namespace || 'default'
  const name = roleBinding.metadata.name
  const appliedns = roleBinding.kind === 'ClusterRoleBinding'
    ? undefined : namespace
  try {
    await single(client, name, appliedns).get()
  } catch (err) {
    return multiple(client, appliedns).create(roleBinding)
      .catch(err => {
        throw new Error(`${roleBinding.kind} '${roleBinding.metadata.namespace}.${roleBinding.metadata.name}' failed to create:\n\t${err.message}`)
      })
  }
}

async function deleteRoleBinding (client, namespace, name) {
  try {
    var spec = await single(client, name, namespace).get()
  } catch (err) {
    return true
  }
  return single(client, name, namespace).delete()
    .catch(err => {
      throw new Error(`${spec.kind} '${namespace}.${name}' could not be deleted:\n\t${err.message}`)
    })
}

function listRoleBindings (client, namespace) {
  let getClusterBindings = () => {
    return client
      .group(group(client))
      .clusterrolebindings
      .list()
  }

  let getBindings = () => {
    return client
      .group(group(client))
      .rolebindings
      .list()
  }

  return join(getClusterBindings(), getBindings(), (cluster, plain) => {
    return cluster.concat(plain)
  })
}

module.exports = function (client) {
  return {
    create: createRoleBinding.bind(null, client),
    delete: deleteRoleBinding.bind(null, client),
    list: listRoleBindings.bind(null, client)
  }
}
