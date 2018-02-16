const Promise = require('bluebird')
const join = Promise.join

const GROUPS = {
  '1.6': 'rbac.authorization.k8s.io/v1beta1',
  '1.7': 'rbac.authorization.k8s.io/v1beta1',
  '1.8': 'rbac.authorization.k8s.io/v1'
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

function createRole (client, role) {
  const namespace = role.metadata.namespace || 'default'
  const name = role.metadata.name
  const appliedns = role.kind === 'ClusterRole'
    ? undefined : namespace
  return single(client, name, appliedns).get()
    .then(
      () => Promise.resolve(),
      () => {
        return multiple(client, appliedns).create(role)
          .then(
            null,
            err => {
              throw new Error(`${role.kind} '${role.metadata.namespace}.${role.metadata.name}' failed to create:\n\t${err.message}`)
            }
          )
      }
    )
}

function deleteRole (client, namespace, name) {
  return single(client, name, namespace).get()
    .then(
      (spec) => {
        return single(client, name, namespace).delete()
          .then(
            null,
            err => {
              throw new Error(`${spec.kind} '${namespace}.${name}' could not be deleted:\n\t${err.message}`)
            }
          )
      },
      () => { return true }
    )
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
