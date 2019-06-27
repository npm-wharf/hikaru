const Promise = require('bluebird')
const join = Promise.join

const GROUPS = {
  '1.6': 'rbac.authorization.k8s.io/v1beta1',
  '1.7': 'rbac.authorization.k8s.io/v1beta1',
  '1.8': 'rbac.authorization.k8s.io/v1',
  '1.9': 'rbac.authorization.k8s.io/v1',
  '1.10': 'rbac.authorization.k8s.io/v1',
  '1.11': 'rbac.authorization.k8s.io/v1',
  '1.12': 'rbac.authorization.k8s.io/v1',
  '1.13': 'rbac.authorization.k8s.io/v1',
  '1.14': 'rbac.authorization.k8s.io/v1',
  '1.15': 'rbac.authorization.k8s.io/v1'
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
      .role(name)
  } else {
    return base(client)
      .clusterrole(name)
  }
}

function multiple (client, namespace) {
  if (namespace) {
    return base(client, namespace)
      .roles
  } else {
    return base(client)
      .clusterroles
  }
}

async function createRole (client, role) {
  const namespace = role.metadata.namespace || 'default'
  const name = role.metadata.name
  const appliedns = role.kind === 'ClusterRole'
    ? undefined : namespace

  try {
    await single(client, name, appliedns).get()
  } catch (e) {
    return multiple(client, appliedns).create(role)
      .catch(err => {
        throw new Error(`${role.kind} '${role.metadata.namespace}.${role.metadata.name}' failed to create:\n\t${err.message}`)
      })
  }
}

async function deleteRole (client, namespace, name) {
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

function listRoles (client, namespace) {
  let getClusterRoles = () => {
    return client
      .group(group(client))
      .clusterrolebindings
      .list()
  }

  let getRoles = () => {
    return client
      .group(group(client))
      .rolebindings
      .list()
  }

  return join(getClusterRoles(), getRoles(), (cluster, plain) => {
    return cluster.concat(plain)
  })
}

module.exports = function (client) {
  return {
    create: createRole.bind(null, client),
    delete: deleteRole.bind(null, client),
    list: listRoles.bind(null, client)
  }
}
