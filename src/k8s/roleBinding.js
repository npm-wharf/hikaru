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

function createRoleBinding (client, roleBinding) {
  const namespace = roleBinding.metadata.namespace || 'default'
  const name = roleBinding.metadata.name
  const appliedns = roleBinding.kind === 'ClusterRoleBinding'
    ? undefined : namespace
  return single(client, name, appliedns).get()
    .then(
      () => Promise.resolve(),
      () => {
        return multiple(client, appliedns).create(roleBinding)
          .then(
            null,
            err => {
              throw new Error(`${roleBinding.kind} '${roleBinding.metadata.namespace}.${roleBinding.metadata.name}' failed to create:\n\t${err.message}`)
            }
          )
      }
    )
}

function deleteRoleBinding (client, namespace, name) {
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

function listRoleBindings (client, namespace) {
  let getClusterBindings = () => {
    return client
      .group('rbac.authorization.k8s.io/v1beta1')
      .clusterrolebindings
      .list()
  }

  let getBindings = () => {
    return client
      .group('rbac.authorization.k8s.io/v1beta1')
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
