const Promise = require('bluebird')
const _ = require('lodash')
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

async function createAccount (k8s, resources) {
  if (resources.account) {
    log.info(`    creating account '${resources.account.metadata.name}'`)
    await k8s.createAccount(resources.account)
      .then(
        onAccountCreated.bind(null, k8s, resources),
        onAccountCreationFailed.bind(null, resources.account)
      )
  }
}

async function createConfiguration (k8s, cluster) {
  const promises = cluster.configuration.map(configuration => {
    log.info(`creating configuration map: '${configuration.metadata.namespace}.${configuration.metadata.name}'`)
    return k8s.createConfiguration(configuration)
  })
  await Promise.all(promises)
}

async function createContainer (k8s, resources) {
  const spec = getContainerSpec(resources)
  if (resources.job || resources.cronjob) {
    await createContainerServices(k8s, resources)
  }
  await getContainer(k8s, resources)
    .catch(
      onContainerCreationFailed.bind(null, spec)
    )
}

async function createContainerServices (k8s, resources) {
  const services = resources.services || []
  await Promise.all(services.map(service => {
    log.info(`    creating service '${service.metadata.name}'`)
    return k8s.createService(service)
      .catch(
        onServiceCreationFailed.bind(null, service)
      )
  }))
}

async function createLevels (k8s, cluster) {
  await Promise.each(cluster.levels, (level) => {
    log.info(`creating level: ${level}`)
    return createServicesInLevel(k8s, level, cluster)
  })
}

async function createNamespaces (k8s, cluster) {
  const promises = cluster.namespaces.map(namespace => {
    log.info(`creating namespace: '${namespace}'`)
    return k8s.createNamespace(namespace)
  })
  await Promise.all(promises)
  await k8s.fixNamespaceLabels()
}

async function createNetworkPolicy (k8s, resources) {
  if (resources.networkPolicy) {
    log.info(`  creating network policy '${resources.networkPolicy.metadata.namespace}.${resources.networkPolicy.metadata.name}'`)
    await k8s.createNetworkPolicy(resources.networkPolicy)
      .catch(
        onNetworkPolicyCreationFailed.bind(null, resources.networkPolicy)
      )
  }
}

async function createRole (k8s, resources) {
  if (resources.role) {
    log.info(`    creating role '${resources.roleBinding.metadata.namespace || 'Cluster'}.${resources.roleBinding.metadata.name}'`)
    await k8s.createRole(resources.role)
      .catch(
        onRoleCreationFailed.bind(null, resources.role)
      )
  }
}

async function createRoleBinding (k8s, resources) {
  if (resources.roleBinding) {
    log.info(`    creating role binding '${resources.roleBinding.metadata.namespace || 'Cluster'}.${resources.roleBinding.metadata.name}'`)
    await k8s.createRoleBinding(resources.roleBinding)
      .catch(
        onRoleBindingCreationFailed.bind(null, resources.roleBinding)
      )
  }
}

async function createServicesInLevel (k8s, level, cluster) {
  const promises = cluster.order[level].reduce((acc, serviceName) => {
    log.info(`  creating resources for '${serviceName}'`)
    return acc.concat(createServiceResources(k8s, cluster.services[serviceName]))
  }, [])
  await Promise.all(promises)
}

async function createServiceResources (k8s, resources) {
  await createAccount(k8s, resources)
  await createContainer(k8s, resources)
    .then(
      onContainerCreated.bind(null, k8s, resources)
    )
}

async function deleteAccount (k8s, resources) {
  if (resources.account) {
    log.info(`    deleting account '${resources.account.metadata.name}'`)
    await k8s.deleteAccount(resources.account)
      .catch(
        onAccountDeletionFailed.bind(null, resources.account)
      )
  }
}

async function deleteConfiguration (k8s, cluster) {
  const promises = cluster.configuration.map(async configuration => {
    log.info(`deleting configuration map: '${configuration.metadata.namespace}.${configuration.metadata.name}'`)
    if (_.includes(RESERVED_NAMESPACES, configuration.metadata.namespace)) {
      await k8s.deleteConfiguration(configuration)
    }
  })
  await Promise.all(promises)
}

async function deleteContainer (k8s, resources) {
  const spec = getContainerSpec(resources)
  await removeContainer(k8s, resources)
    .catch(
      onContainerDeletionFailed.bind(null, spec)
    )
}

async function deleteContainerServices (k8s, resources) {
  const services = resources.services || []
  await Promise.all(services.map(async service => {
    log.info(`    deleting service '${service.metadata.name}'`)
    await k8s.deleteService(service)
      .catch(
        onServiceDeletionFailed.bind(null, service)
      )
  }))
}

async function deleteLevels (k8s, cluster) {
  cluster.levels.reverse()
  await Promise.each(cluster.levels, (level) => {
    log.info(`deleting level: ${level}`)
    return deleteServicesInLevel(k8s, level, cluster)
  })
}

async function deleteNamespaces (k8s, cluster) {
  const namespaces = _.difference(cluster.namespaces, RESERVED_NAMESPACES)
  const promises = namespaces.map(namespace => {
    log.info(`deleting namespace: '${namespace}'`)
    return k8s.deleteNamespace(namespace)
  })
  await Promise.all(promises)
}

async function deleteNetworkPolicy (k8s, resources) {
  if (resources.networkPolicy) {
    log.info(`  deleting network policy '${resources.networkPolicy.metadata.namespace}.${resources.networkPolicy.metadata.name}'`)
    await k8s.deleteNetworkPolicy(resources.networkPolicy)
      .catch(
        onNetworkPolicyDeletionFailed.bind(null, resources.networkPolicy)
      )
  }
}

async function deleteRole (k8s, resources) {
  if (resources.role) {
    log.info(`    deleting role '${resources.roleBinding.metadata.namespace}'.${resources.roleBinding.metadata.name}'`)
    await k8s.deleteRole(resources.roleBinding)
      .catch(
        onRoleDeletionFailed.bind(null, resources.roleBinding)
      )
  }
}

async function deleteRoleBinding (k8s, resources) {
  if (resources.roleBinding) {
    log.info(`    deleting role binding '${resources.roleBinding.metadata.name}'`)
    await k8s.deleteRoleBinding(resources.roleBinding)
      .catch(
        onRoleBindingDeletionFailed.bind(null, resources.roleBinding)
      )
  }
}

async function deleteServicesInLevel (k8s, level, cluster) {
  const promises = cluster.order[level].reduce((acc, serviceName) => {
    const reserved = _.includes(RESERVED_NAMESPACES, cluster.services[serviceName].namespace)
    if (reserved) {
      log.info(`  deleting resources for '${serviceName}'`)
      return acc.concat(deleteServiceResources(k8s, cluster.services[serviceName]))
    } else {
      return acc
    }
  }, [])
  await Promise.all(promises)
}

async function deleteServiceResources (k8s, resources) {
  await deleteAccount(k8s, resources)
  await onAccountDeleted(k8s, resources)
}

async function deployCluster (k8s, cluster) {
  await createNamespaces(k8s, cluster)
    .catch(
      onNamespaceCreationFailed.bind(null, cluster)
    )
  await onNamespacesCreated(k8s, cluster)
}

function exitOnError () {
  process.exit(100)
}

function filterContainerManifests (manifest) {
  return manifest.kind !== undefined &&
    MANIFEST_KIND_FILTER.indexOf(manifest.kind) < 0
}

async function findResourcesByImage (k8s, image) {
  let testResource = list => resource => {
    if (resource.image.indexOf(image) >= 0) {
      list.push(resource)
    }
  }

  const images = await getImageMetadata(k8s, {baseImage: image})
  const namespaces = Object.keys(images)
  return namespaces.reduce((acc, namespace) => {
    const resources = images[namespace]
    resources.daemonSets.forEach(testResource(acc))
    resources.deployments.forEach(testResource(acc))
    resources.statefulSets.forEach(testResource(acc))
    return acc
  }, [])
}

async function findResourcesByMetadata (k8s, metadata) {
  let testResource = list => resource => {
    if (match(resource.metadata, metadata, resource.labels)) {
      list.push(resource)
    }
  }

  const images = await getImageMetadata(k8s)
  const namespaces = Object.keys(images)
  return namespaces.reduce((acc, namespace) => {
    const resources = images[namespace]
    resources.daemonSets.forEach(testResource(acc))
    resources.deployments.forEach(testResource(acc))
    resources.statefulSets.forEach(testResource(acc))
    return acc
  }, [])
}

async function getContainer (k8s, resources) {
  if (resources.daemonSet) {
    log.info(`    creating daemonSet '${resources.daemonSet.metadata.name}'`)
    await k8s.createDaemonSet(resources.daemonSet)
  } else if (resources.deployment) {
    log.info(`    creating deployment '${resources.deployment.metadata.name}'`)
    await k8s.createDeployment(resources.deployment)
  } else if (resources.statefulSet) {
    log.info(`    creating statefulSet '${resources.statefulSet.metadata.name}'`)
    await k8s.createStatefulSet(resources.statefulSet)
  } else if (resources.cronJob) {
    log.info(`    creating cronJob '${resources.cronJob.metadata.name}'`)
    await k8s.createCronJob(resources.cronJob)
  } else if (resources.job) {
    log.info(`    creating job '${resources.job.metadata.name}'`)
    await k8s.createJob(resources.job)
  } else {
    const manifest = _.find(
      _.values(resources),
      filterContainerManifests
    )
    if (manifest) {
      const kind = manifest.kind.toLowerCase()
      log.info(`    creating ${kind} '${manifest.metadata.name}'`)
      await k8s.createManifest(manifest)
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

async function getImageMetadata (k8s, options) {
  const namespaces = await k8s.listNamespaces()
    .catch(err => {
      log.error(`Failed to get image metadata - error while retrieving namespace list:\n\t${err.message}`)
      throw err
    })
  return Promise.reduce(namespaces, async (acc, namespace) => {
    const result = await getImageMetadataForNamespace(k8s, namespace, options)
      .catch(err => {
        log.error(`Failed to get image metadata for namespace '${namespace}':\n\t${err.stack}'`)
      })

    acc[result.namespace] = result
    return acc
  }, {})
}

async function getImageMetadataForNamespace (k8s, namespace, options = {}) {
  const [deployments, daemons, sets] = await Promise.all([
    k8s.getDeploymentsByNamespace(namespace, options.baseImage),
    k8s.getDaemonSetsByNamespace(namespace, options.baseImage),
    k8s.getStatefulSetsByNamespace(namespace, options.baseImage)
  ])
  return Object.assign({}, deployments, daemons, sets)
}

async function getNamespaces (k8s) {
  await k8s.listNamespaces()
}

async function getUpgradeCandidates (k8s, image, options = {filter: ['imageName', 'imageOwner', 'owner', 'repo', 'branch']}) {
  if (!options.filter || options.filter.length === 0) {
    throw new Error(`hikaru was given an upgrade command with image '${image} and no filter which would result in forcing all resources to the same image. This command would certainly destroy the cluster and is refused.`)
  }
  const sourceMeta = parse(image, false)
  let filter = _.pick(sourceMeta, options.filter)
  filter = _.pickBy(filter, _.identity)
  log.info(`identifying candidates for ${image} with filter fields '[${options.filter.join(', ')}]' for resources matching: ${JSON.stringify(filter)}`)
  const list = await findResourcesByMetadata(k8s, filter)
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

async function onAccountCreated (k8s, resources) {
  await createRole(k8s, resources)
  await onRoleCreated(k8s, resources)
}

function onAccountDeletionFailed (account, err) {
  log.error(`Failed to create account '${account.metadata.namespace}.${account.metadata.name}' with error:\n\t${err.message}`)
  throw err
}

async function onAccountDeleted (k8s, resources) {
  await deleteRoleBinding(k8s, resources)
  await onRoleBindingDeleted(k8s, resources)
}

async function onConfigurationCreated (k8s, cluster) {
  log.info('configuration maps created')
  await createLevels(k8s, cluster)
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
  log.error(`Failed to erase cluster resources with error:\n\t${err.stack}`)
  throw err
}

async function onNamespacesCreated (k8s, cluster) {
  log.info('namespaces created')
  await createConfiguration(k8s, cluster)
    .catch(onConfigurationCreationFailed.bind(null, cluster))
    .catch(exitOnError)

  await onConfigurationCreated(k8s, cluster)
}

async function onNamespacesDeleted (k8s, cluster) {
  log.info('namespaces deleted')
  await deleteConfiguration(k8s, cluster)
    .catch(
      onConfigurationDeletionFailed.bind(null, cluster)
    )
    .catch(exitOnError)
  await onConfigurationDeleted(k8s, cluster)
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
}

async function onRoleDeleted (k8s, resources) {
  await deleteContainer(k8s, resources)
  await onContainerDeleted(k8s, resources)
}

function onRoleCreationFailed (role, err) {
  log.error(`Failed to create role '${role.metadata.namespace || 'Cluster'}.${role.metadata.name}' with error:\n\t${err.message}`)
  throw err
}

function onRoleDeletionFailed (role, err) {
  log.error(`Failed to delete role '${role.metadata.namespace || 'Cluster'}.${role.metadata.name}' with error:\n\t${err.message}`)
  throw err
}

async function onRoleBindingDeleted (k8s, resources) {
  await deleteRole(k8s, resources)
  await onRoleDeleted(k8s, resources)
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

async function removeCluster (k8s, cluster) {
  await deleteNamespaces(k8s, cluster)
    .catch(
      onNamespaceDeletionFailed.bind(null, cluster)
    )
  await onNamespacesDeleted(k8s, cluster)
}

async function removeContainer (k8s, resources) {
  if (resources.daemonSet) {
    log.info(`    deleting daemonSet '${resources.daemonSet.metadata.name}'`)
    await k8s.deleteDaemonSet(resources.daemonSet.metadata.namespace, resources.daemonSet.metadata.name)
  } else if (resources.deployment) {
    log.info(`    deleting deployment '${resources.deployment.metadata.name}'`)
    await k8s.deleteDeployment(resources.deployment.metadata.namespace, resources.deployment.metadata.name)
  } else if (resources.statefulSet) {
    log.info(`    deleting statefulSet '${resources.statefulSet.metadata.name}'`)
    await k8s.deleteStatefulSet(resources.statefulSet.metadata.namespace, resources.statefulSet.metadata.name)
  } else if (resources.cronJob) {
    log.info(`    deleting cronJob '${resources.cronJob.metadata.name}'`)
    await k8s.deleteCronJob(resources.cronJob.metadata.namespace, resources.cronJob.metadata.name)
  } else if (resources.job) {
    log.info(`    deleting job '${resources.job.metadata.name}'`)
    await k8s.deleteJob(resources.job.metadata.namespace, resources.job.metadata.name)
  }
}

async function runJob (k8s, cluster, namespace, jobName) {
  const fullName = `${jobName}.${namespace}`
  const jobSpec = cluster.services[fullName]
  if (!jobSpec) {
    throw new Error(`no job '${jobName}' in namespace '${namespace}', please check the specification and spelling`)
  }
  log.info(`creating job prerequisites: '${namespace}'`)
  try {
    await k8s.createNamespace(namespace)
    await k8s.fixNamespaceLabels()
    await createConfiguration(k8s, cluster)
    await createAccount(k8s, jobSpec)
    await createNetworkPolicy(k8s, jobSpec)
  } catch (err) {
    log.error(`failed to establish namespace '${namespace}' - cannot run job '${jobName}': ${err.stack}`)
    throw new Error(`cannot run job '${jobName}' - could not establish '${namespace}: ${err.stack}'`)
  }

  await k8s.runJob(namespace, jobName, jobSpec.job)
    .catch(err => {
      log.error(`failed to run job '${jobName}' in '${namespace}': ${err.stack}`)
      throw err
    })
}

async function upgradeResources (k8s, image, options) {
  const set = await getUpgradeCandidates(k8s, image, options)
    .catch(err => {
      log.error(`Upgrade process for '${image}' failed with error:\n\t${err.message}`)
    })
  const upgrades = set.upgrade.map(upgradeResource.bind(null, k8s))
  await Promise.all(upgrades)
  return set
}

async function upgradeResource (k8s, metadata) {
  const namespace = metadata.namespace
  const name = metadata.service
  const container = metadata.container
  const image = metadata.comparedTo
  if (/daemonset/i.test(metadata.type)) {
    await k8s.updateDaemonSet(namespace, name, image, container)
  } else if (/deployment/i.test(metadata.type)) {
    await k8s.upgradeDeployment(namespace, name, image, container)
  } else if (/statefulset/i.test(metadata.type)) {
    await k8s.upgradeStatefulSet(namespace, name, image, container)
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
    runJob: runJob.bind(null, k8s),
    upgradeResources: upgradeResources.bind(null, k8s),
    upgradeResource: upgradeResource.bind(null, k8s)
  }
}
