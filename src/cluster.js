const Promise = require('bluebird')
const _ = require('lodash')
const join = Promise.join
const log = require('bole')('cluster')
const parse = require('./imageParser').parse
const compare = require('./imageComparer').compare

const RESERVED_NAMESPACES = ['default', 'kube-system', 'kube-public']
const MATCH_KEYS = ['imageOwner', 'imageName', 'owner', 'repo', 'branch']
const MANIFEST_KIND_FILTER = [
  'ClusterRole',
  'ClusterRoleBinding',
  'ConfigMap',
  'CronJob',
  'DaemonSet',
  'Deployment',
  'Job',
  'NetworkPolicy',
  'Role',
  'RoleBinding',
  'Service',
  'ServiceAccount',
  'StatefulSet'
]

function createAccount (k8s, resources) {
  let accountPromise
  if (resources.account) {
    log.info(`    creating account '${resources.account.metadata.name}'`)
    accountPromise = k8s.createAccount(resources.account)
      .then(
        null,
        onAccountCreationFailed.bind(null, resources.account)
      )
  } else {
    accountPromise = Promise.resolve()
  }
  return accountPromise
}

function createConfiguration (k8s, cluster) {
  const promises = cluster.configuration.map(configuration => {
    log.info(`creating configuration map: '${configuration.metadata.namespace}.${configuration.metadata.name}'`)
    return k8s.createConfiguration(configuration)
  })
  return Promise.all(promises)
}

function createContainer (k8s, resources) {
  const spec = getContainerSpec(resources)
  const create = () => {
    return getContainer(k8s, resources)
      .then(
        null,
        onContainerCreationFailed.bind(null, spec)
      )
  }
  if (resources.job || resources.cronjob) {
    return createContainerServices(k8s, resources)
      .then(create)
  } else {
    return create()
  }
}

function createContainerServices (k8s, resources) {
  const services = resources.services || []
  return Promise.all(services.map(service => {
    log.info(`    creating service '${service.metadata.name}'`)
    return k8s.createService(service)
      .then(
        null,
        onServiceCreationFailed.bind(null, service)
      )
  }))
}

function createLevels (k8s, cluster) {
  return Promise.each(cluster.levels, (level) => {
    log.info(`creating level: ${level}`)
    return createServicesInLevel(k8s, level, cluster)
  })
}

function createNamespaces (k8s, cluster) {
  const promises = cluster.namespaces.map(namespace => {
    log.info(`creating namespace: '${namespace}'`)
    return k8s.createNamespace(namespace)
  })
  promises.push(k8s.fixNamespaceLabels())
  return Promise.all(promises)
}

function createNetworkPolicy (k8s, resources) {
  let policyPromise
  if (resources.networkPolicy) {
    log.info(`  creating network policy '${resources.networkPolicy.metadata.namespace}.${resources.networkPolicy.metadata.name}'`)
    policyPromise = k8s.createNetworkPolicy(resources.networkPolicy)
      .then(
        null,
        onNetworkPolicyCreationFailed.bind(null, resources.networkPolicy)
      )
  } else {
    policyPromise = Promise.resolve()
  }
  return policyPromise
}

function createRole (k8s, resources) {
  let bindingPromise
  if (resources.role) {
    log.info(`    creating role '${resources.roleBinding.metadata.namespace || 'Cluster'}.${resources.roleBinding.metadata.name}'`)
    bindingPromise = k8s.createRole(resources.role)
      .then(
        null,
        onRoleCreationFailed.bind(null, resources.role)
      )
  } else {
    bindingPromise = Promise.resolve()
  }
  return bindingPromise
}

function createRoleBinding (k8s, resources) {
  let bindingPromise
  if (resources.roleBinding) {
    log.info(`    creating role binding '${resources.roleBinding.metadata.namespace || 'Cluster'}.${resources.roleBinding.metadata.name}'`)
    bindingPromise = k8s.createRoleBinding(resources.roleBinding)
      .then(
        null,
        onRoleBindingCreationFailed.bind(null, resources.roleBinding)
      )
  } else {
    bindingPromise = Promise.resolve()
  }
  return bindingPromise
}

function createServicesInLevel (k8s, level, cluster) {
  const promises = cluster.order[level].reduce((acc, serviceName) => {
    log.info(`  creating resources for '${serviceName}'`)
    return acc.concat(createServiceResources(k8s, cluster.services[serviceName]))
  }, [])
  return Promise.all(promises)
}

function createServiceResources (k8s, resources) {
  return createAccount(k8s, resources)
    .then(
      onAccountCreated.bind(null, k8s, resources)
    )
}

function deleteAccount (k8s, resources) {
  let accountPromise
  if (resources.account) {
    log.info(`    deleting account '${resources.account.metadata.name}'`)
    accountPromise = k8s.deleteAccount(resources.account)
      .then(
        null,
        onAccountDeletionFailed.bind(null, resources.account)
      )
  } else {
    accountPromise = Promise.resolve()
  }
  return accountPromise
}

function deleteConfiguration (k8s, cluster) {
  const promises = cluster.configuration.map(configuration => {
    log.info(`deleting configuration map: '${configuration.metadata.namespace}.${configuration.metadata.name}'`)
    if (_.includes(RESERVED_NAMESPACES, configuration.metadata.namespace)) {
      return k8s.deleteConfiguration(configuration)
    }
    return Promise.resolve()
  })
  return Promise.all(promises)
}

function deleteContainer (k8s, resources) {
  const spec = getContainerSpec(resources)
  return removeContainer(k8s, resources)
    .then(
      null,
      onContainerDeletionFailed.bind(null, spec)
    )
}

function deleteContainerServices (k8s, resources) {
  const services = resources.services || []
  return Promise.all(services.map(service => {
    log.info(`    deleting service '${service.metadata.name}'`)
    return k8s.deleteService(service)
      .then(
        null,
        onServiceDeletionFailed.bind(null, service)
      )
  }))
}

function deleteLevels (k8s, cluster) {
  cluster.levels.reverse()
  return Promise.each(cluster.levels, (level) => {
    log.info(`deleting level: ${level}`)
    return deleteServicesInLevel(k8s, level, cluster)
  })
}

function deleteNamespaces (k8s, cluster) {
  const namespaces = _.difference(cluster.namespaces, RESERVED_NAMESPACES)
  const promises = namespaces.map(namespace => {
    log.info(`deleting namespace: '${namespace}'`)
    return k8s.deleteNamespace(namespace)
  })
  return Promise.all(promises)
}

function deleteNetworkPolicy (k8s, resources) {
  let policyPromise
  if (resources.networkPolicy) {
    log.info(`  deleting network policy '${resources.networkPolicy.metadata.namespace}.${resources.networkPolicy.metadata.name}'`)
    policyPromise = k8s.deleteNetworkPolicy(resources.networkPolicy)
      .then(
        null,
        onNetworkPolicyDeletionFailed.bind(null, resources.networkPolicy)
      )
  } else {
    policyPromise = Promise.resolve()
  }
  return policyPromise
}

function deleteRole (k8s, resources) {
  let bindingPromise
  if (resources.role) {
    log.info(`    deleting role '${resources.roleBinding.metadata.namespace}'.${resources.roleBinding.metadata.name}'`)
    bindingPromise = k8s.deleteRole(resources.roleBinding)
      .then(
        null,
        onRoleDeletionFailed.bind(null, resources.roleBinding)
      )
  } else {
    bindingPromise = Promise.resolve()
  }
  return bindingPromise
}

function deleteRoleBinding (k8s, resources) {
  let bindingPromise
  if (resources.roleBinding) {
    log.info(`    deleting role binding '${resources.roleBinding.metadata.name}'`)
    bindingPromise = k8s.deleteRoleBinding(resources.roleBinding)
      .then(
        null,
        onRoleBindingDeletionFailed.bind(null, resources.roleBinding)
      )
  } else {
    bindingPromise = Promise.resolve()
  }
  return bindingPromise
}

function deleteServicesInLevel (k8s, level, cluster) {
  const promises = cluster.order[level].reduce((acc, serviceName) => {
    const reserved = _.includes(RESERVED_NAMESPACES, cluster.services[serviceName].namespace)
    if (reserved) {
      log.info(`  deleting resources for '${serviceName}'`)
      return acc.concat(deleteServiceResources(k8s, cluster.services[serviceName]))
    } else {
      return acc
    }
  }, [])
  return Promise.all(promises)
}

function deleteServiceResources (k8s, resources) {
  return deleteAccount(k8s, resources)
    .then(
      onAccountDeleted.bind(null, k8s, resources)
    )
}

function deployCluster (k8s, cluster) {
  return createNamespaces(k8s, cluster)
    .then(
      onNamespacesCreated.bind(null, k8s, cluster),
      onNamespaceCreationFailed.bind(null, cluster)
    )
}

function exitOnError () {
  process.exit(100)
}

function filterContainerManifests (manifest) {
  return manifest.kind !== undefined &&
    MANIFEST_KIND_FILTER.indexOf(manifest.kind) < 0
}

function findResourcesByImage (k8s, image) {
  let testResource = (list, resource) => {
    if (resource.image.indexOf(image) >= 0) {
      list.push(resource)
    }
  }

  return getImageMetadata(k8s, {baseImage: image})
    .then(
      images => {
        const namespaces = Object.keys(images)
        return namespaces.reduce((acc, namespace) => {
          const resources = images[namespace]
          resources.daemonSets.forEach(testResource.bind(null, acc))
          resources.deployments.forEach(testResource.bind(null, acc))
          resources.statefulSets.forEach(testResource.bind(null, acc))
          return acc
        }, [])
      }
    )
}

function findResourcesByMetadata (k8s, metadata) {
  let testResource = (list, resource) => {
    if (match(resource.metadata, metadata, resource.labels)) {
      list.push(resource)
    }
  }

  return getImageMetadata(k8s)
    .then(
      images => {
        const namespaces = Object.keys(images)
        return namespaces.reduce((acc, namespace) => {
          const resources = images[namespace]
          resources.daemonSets.forEach(testResource.bind(null, acc))
          resources.deployments.forEach(testResource.bind(null, acc))
          resources.statefulSets.forEach(testResource.bind(null, acc))
          return acc
        }, [])
      }
    )
}

function getContainer (k8s, resources) {
  if (resources.daemonSet) {
    log.info(`    creating daemonSet '${resources.daemonSet.metadata.name}'`)
    return k8s.createDaemonSet(resources.daemonSet)
  } else if (resources.deployment) {
    log.info(`    creating deployment '${resources.deployment.metadata.name}'`)
    return k8s.createDeployment(resources.deployment)
  } else if (resources.statefulSet) {
    log.info(`    creating statefulSet '${resources.statefulSet.metadata.name}'`)
    return k8s.createStatefulSet(resources.statefulSet)
  } else if (resources.cronJob) {
    log.info(`    creating cronJob '${resources.cronJob.metadata.name}'`)
    return k8s.createCronJob(resources.cronJob)
  } else if (resources.job) {
    log.info(`    creating job '${resources.job.metadata.name}'`)
    return k8s.createJob(resources.job)
  } else {
    const manifest = _.find(
      _.values(resources),
      filterContainerManifests
    )
    if (manifest) {
      const kind = manifest.kind.toLowerCase()
      log.info(`    creating ${kind} '${manifest.metadata.name}'`)
      return k8s.createManifest(manifest)
    } else {
      return Promise.resolve()
    }
  }
}

function getContainerSpec (resources) {
  if (resources.daemonSet) {
    return resources.daemonSet
  } else if (resources.deployment) {
    return resources.deployment
  } else if (resources.statefulSet) {
    return resources.statefulSet
  } else if (resources.cronJob) {
    return resources.cronJob
  } else if (resources.job) {
    return resources.job
  } else {
    const manifest = _.find(
      _.values(resources),
      o => o.kind != undefined // eslint-disable-line eqeqeq
    )
    return manifest
  }
}

function getImageMetadata (k8s, options) {
  return k8s.listNamespaces()
    .then(
      namespaces => {
        return Promise.reduce(namespaces, (acc, namespace) => {
          return getImageMetadataForNamespace(k8s, namespace, options)
            .then(
              result => {
                acc[result.namespace] = result
                return acc
              },
              err => {
                log.error(`Failed to get image metadata for namespace '${namespace}':\n\t${err.stack}'`)
              }
            )
        }, {})
      },
      err => {
        log.error(`Failed to get image metadata - error while retrieving namespace list:\n\t${err.message}`)
        throw err
      }
    )
}

function getImageMetadataForNamespace (k8s, namespace, options = {}) {
  let getDeployments = () => k8s.getDeploymentsByNamespace(namespace, options.baseImage)
  let getDaemons = () => k8s.getDaemonSetsByNamespace(namespace, options.baseImage)
  let getStateful = () => k8s.getStatefulSetsByNamespace(namespace, options.baseImage)

  return join(
    getDeployments(),
    getDaemons(),
    getStateful(),
    (deployments, daemons, sets) => {
      const merged = Object.assign({}, deployments, daemons, sets)
      return merged
    }
  )
}

function getNamespaces (k8s) {
  return k8s.listNamespaces()
}

function getUpgradeCandidates (k8s, image, options = {filter: ['imageName', 'imageOwner', 'owner', 'repo', 'branch']}) {
  if (!options.filter || options.filter.length === 0) {
    throw new Error(`hikaru was given an upgrade command with image '${image} and no filter which would result in forcing all resources to the same image. This command would certainly destroy the cluster and is refused.`)
  }
  const sourceMeta = parse(image, false)
  let filter = _.pick(sourceMeta, options.filter)
  filter = _.pickBy(filter, _.identity)
  log.info(`identifying candidates for ${image} with filter fields '[${options.filter.join(', ')}]' for resources matching: ${JSON.stringify(filter)}`)
  return findResourcesByMetadata(k8s, filter)
    .then(
      list => {
        return list.reduce((acc, resource) => {
          const diff = compare(resource.image, image)
          resource.diff = diff
          resource.comparedTo = image
          if (acc[diff]) {
            acc[diff].push(resource)
          } else {
            acc.error.push(resource)
          }
          return acc
        }, {upgrade: [], obsolete: [], equal: [], error: []})
      }
    )
}

function match (target, props, options = {}) {
  let keys = options.filter
    ? options.filter.split(',').map(x => x.trim())
    : MATCH_KEYS
  return keys.reduce((matches, key) => {
    if (props[key] !== target[key]) {
      matches = false
    }
    if (options[key] && options[key] !== target[key]) {
      matches = false
    }
    return matches
  }, true)
}

function onAccountCreationFailed (account, err) {
  log.error(`Failed to create account '${account.metadata.namespace}.${account.metadata.name}' with error:\n\t${err.message}`)
  throw err
}

function onAccountCreated (k8s, resources) {
  return createRole(k8s, resources)
    .then(
      onRoleCreated.bind(null, k8s, resources)
    )
}

function onAccountDeletionFailed (account, err) {
  log.error(`Failed to create account '${account.metadata.namespace}.${account.metadata.name}' with error:\n\t${err.message}`)
  throw err
}

function onAccountDeleted (k8s, resources) {
  return deleteRoleBinding(k8s, resources)
    .then(
      onRoleBindingDeleted.bind(null, k8s, resources)
    )
}

function onConfigurationCreated (k8s, cluster) {
  log.info('configuration maps created')
  return createLevels(k8s, cluster)
    .then(
      () => log.info('cluster initialization complete'),
      onResourcesFailed
    )
    .catch(exitOnError)
}

function onConfigurationCreationFailed (cluster, err) {
  log.error(`Failed to create configuration maps with error:\n\t${err.message}`)
  throw err
}

function onConfigurationDeleted (k8s, cluster) {
  log.info('configuration maps deleted')
  return deleteLevels(k8s, cluster)
    .then(
      () => log.info('cluster deletion complete'),
      onDeletionFailed
    )
    .catch(exitOnError)
}

function onConfigurationDeletionFailed (cluster, err) {
  log.error(`Failed to delete configuration maps with error:\n\t${err.message}`)
  throw err
}

function onContainerCreated (k8s, resources) {
  return createContainerServices(k8s, resources)
    .then(
      onContainerServiceCreated.bind(null, k8s, resources)
    )
}

function onContainerCreationFailed (spec, err) {
  log.error(`Failed to create container '${spec.metadata.namespace}.${spec.metadata.name}' with error:\n\t${err.message}`)
  throw err
}

function onContainerDeleted (k8s, resources) {
  return deleteContainerServices(k8s, resources)
}

function onContainerDeletionFailed (spec, err) {
  log.error(`Failed to delete container '${spec.metadata.namespace}.${spec.metadata.name}' with error:\n\t${err.message}`)
  throw err
}

function onContainerServiceCreated (k8s, resources) {
  return createNetworkPolicy(k8s, resources)
}

function onDeletionFailed (err) {
  log.error(`Failed to erase cluster resources with error:\n\t${err.message}`)
  throw err
}

function onNamespacesCreated (k8s, cluster) {
  log.info('namespaces created')
  return createConfiguration(k8s, cluster)
    .then(
      onConfigurationCreated.bind(null, k8s, cluster),
      onConfigurationCreationFailed.bind(null, cluster)
    )
    .catch(exitOnError)
}

function onNamespacesDeleted (k8s, cluster) {
  log.info('namespaces deleted')
  return deleteConfiguration(k8s, cluster)
    .then(
      onConfigurationDeleted.bind(null, k8s, cluster),
      onConfigurationDeletionFailed.bind(null, cluster)
    )
    .catch(exitOnError)
}

function onNamespaceCreationFailed (cluster, err) {
  log.error(`Failed to create namespaces '${cluster.namespaces.join(', ')}' with error:\n\t${err.message}`)
  throw err
}

function onNamespaceDeletionFailed (cluster, err) {
  log.error(`Failed to delete namespaces '${cluster.namespaces.join(', ')}' with error:\n\t${err.message}`)
  throw err
}

function onNetworkPolicyCreationFailed (policy, err) {
  log.error(`Failed to create network policy '${policy.metadata.namespace}.${policy.metadata.name}' with error:\n\t${err.message}`)
  throw err
}

function onNetworkPolicyDeletionFailed (policy, err) {
  log.error(`Failed to delete network policy '${policy.metadata.namespace}.${policy.metadata.name}' with error:\n\t${err.message}`)
  throw err
}

function onResourcesFailed (err) {
  log.error(`Failed to setup cluster resources with error:\n\t${err.message}\n\t${err.stack}`)
  throw err
}

function onRoleCreated (k8s, resources) {
  return createRoleBinding(k8s, resources)
    .then(
      onRoleBindingCreated.bind(null, k8s, resources)
    )
}

function onRoleDeleted (k8s, resources) {
  return deleteContainer(k8s, resources)
    .then(
      onContainerDeleted.bind(null, k8s, resources)
    )
}

function onRoleCreationFailed (role, err) {
  log.error(`Failed to create role '${role.metadata.namespace || 'Cluster'}.${role.metadata.name}' with error:\n\t${err.message}`)
  throw err
}

function onRoleDeletionFailed (role, err) {
  log.error(`Failed to delete role '${role.metadata.namespace || 'Cluster'}.${role.metadata.name}' with error:\n\t${err.message}`)
  throw err
}

function onRoleBindingCreated (k8s, resources) {
  return createContainer(k8s, resources)
    .then(
      onContainerCreated.bind(null, k8s, resources)
    )
}

function onRoleBindingDeleted (k8s, resources) {
  return deleteRole(k8s, resources)
    .then(
      onRoleDeleted.bind(null, k8s, resources)
    )
}

function onRoleBindingCreationFailed (binding, err) {
  log.error(`Failed to create role binding '${binding.metadata.namespace}.${binding.metadata.name}' with error:\n\t${err.message}`)
  throw err
}

function onRoleBindingDeletionFailed (binding, err) {
  log.error(`Failed to delete role binding '${binding.metadata.namespace}.${binding.metadata.name}' with error:\n\t${err.message}`)
  throw err
}

function onServiceCreationFailed (service, err) {
  log.error(`Failed to create service '${service.metadata.namespace}.${service.metadata.name}' with error:\n\t${err.message}`)
  throw err
}

function onServiceDeletionFailed (service, err) {
  log.error(`Failed to delete service '${service.metadata.namespace}.${service.metadata.name}' with error:\n\t${err.message}`)
  throw err
}

function removeCluster (k8s, cluster) {
  return deleteNamespaces(k8s, cluster)
    .then(
      onNamespacesDeleted.bind(null, k8s, cluster),
      onNamespaceDeletionFailed.bind(null, cluster)
    )
}

function removeContainer (k8s, resources) {
  if (resources.daemonSet) {
    log.info(`    deleting daemonSet '${resources.daemonSet.metadata.name}'`)
    return k8s.deleteDaemonSet(resources.daemonSet.metadata.namespace, resources.daemonSet.metadata.name)
  } else if (resources.deployment) {
    log.info(`    deleting deployment '${resources.deployment.metadata.name}'`)
    return k8s.deleteDeployment(resources.deployment.metadata.namespace, resources.deployment.metadata.name)
  } else if (resources.statefulSet) {
    log.info(`    deleting statefulSet '${resources.statefulSet.metadata.name}'`)
    return k8s.deleteStatefulSet(resources.statefulSet.metadata.namespace, resources.statefulSet.metadata.name)
  } else if (resources.cronJob) {
    log.info(`    deleting cronJob '${resources.cronJob.metadata.name}'`)
    return k8s.deleteCronJob(resources.cronJob.metadata.namespace, resources.cronJob.metadata.name)
  } else if (resources.job) {
    log.info(`    deleting job '${resources.job.metadata.name}'`)
    return k8s.deleteJob(resources.job.metadata.namespace, resources.job.metadata.name)
  }
}

function upgradeResources (k8s, image, options) {
  return getUpgradeCandidates(k8s, image, options)
    .then(
      set => {
        const upgrades = set.upgrade.map(upgradeResource.bind(null, k8s))
        return Promise
          .all(upgrades)
          .then(
            () => set
          )
      },
      err => {
        log.error(`Upgrade process for '${image}' failed with error:\n\t${err.message}`)
      }
    )
}

function upgradeResource (k8s, metadata) {
  const namespace = metadata.namespace
  const name = metadata.service
  const container = metadata.container
  const image = metadata.comparedTo
  if (/daemonset/i.test(metadata.type)) {
    return k8s.updateDaemonSet(namespace, name, image, container)
  } else if (/deployment/i.test(metadata.type)) {
    return k8s.upgradeDeployment(namespace, name, image, container)
  } else if (/statefulset/i.test(metadata.type)) {
    return k8s.upgradeStatefulSet(namespace, name, image, container)
  }
}

module.exports = function (k8s) {
  return {
    k8s: k8s,
    createAccount: createAccount.bind(null, k8s),
    createConfiguration: createConfiguration.bind(null, k8s),
    createContainer: createContainer.bind(null, k8s),
    createContainerServices: createContainerServices.bind(null, k8s),
    createLevels: createLevels.bind(null, k8s),
    createNamespaces: createNamespaces.bind(null, k8s),
    createNetworkPolicy: createNetworkPolicy.bind(null, k8s),
    createRoleBinding: createRoleBinding.bind(null, k8s),
    createServicesInLevel: createServicesInLevel.bind(null, k8s),
    createServiceResources: createServiceResources.bind(null, k8s),
    deleteAccount: deleteAccount.bind(null, k8s),
    deleteConfiguration: deleteConfiguration.bind(null, k8s),
    deleteContainer: deleteContainer.bind(null, k8s),
    deleteContainerServices: deleteContainerServices.bind(null, k8s),
    deleteLevels: deleteLevels.bind(null, k8s),
    deleteNamespaces: deleteNamespaces.bind(null, k8s),
    deleteNetworkPolicy: deleteNetworkPolicy.bind(null, k8s),
    deleteRoleBinding: deleteRoleBinding.bind(null, k8s),
    deleteServicesInLevel: deleteServicesInLevel.bind(null, k8s),
    deleteServiceResources: deleteServiceResources.bind(null, k8s),
    deployCluster: deployCluster.bind(null, k8s),
    findResourcesByImage: findResourcesByImage.bind(null, k8s),
    findResourcesByMetadata: findResourcesByMetadata.bind(null, k8s),
    getContainer: getContainer.bind(null, k8s),
    getContainerSpec: getContainerSpec.bind(null, k8s),
    getImageMetadata: getImageMetadata.bind(null, k8s),
    getImageMetadataForNamespace: getImageMetadataForNamespace.bind(null, k8s),
    getNamespaces: getNamespaces.bind(null, k8s),
    getUpgradeCandidates: getUpgradeCandidates.bind(null, k8s),
    match: match,
    removeCluster: removeCluster.bind(null, k8s),
    removeContainer: removeContainer.bind(null, k8s),
    upgradeResources: upgradeResources.bind(null, k8s),
    upgradeResource: upgradeResource.bind(null, k8s)
  }
}
