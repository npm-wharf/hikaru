'use strict'

const mcgonagall = require('@npm-wharf/mcgonagall')

const kubectl = require('./kubectl')
const resources = require('./resources')

function logResponse (options, res) {
  const { logger } = options
  if (!res.kind.endsWith('List')) {
    res = { kind: 'List', apiVersion: 'v1', metadata: {}, items: [res] }
  }

  if (res.items.length === 0) {
    logger.debug('No items returned from kubectl')
    return
  }

  const itemInfos = []
  for (const item of res.items) {
    let itemInfo = `${item.kind}: ${item.metadata.name}.${item.metadata.namespace}`
    itemInfos.push(itemInfo)
    if (item.kind === 'StatefulSet') {
      if (item.status.currentRevision === item.status.updateRevision) {
        logger.debug(`  - ${itemInfo} - unchanged`)
      } else {
        logger.info(`  - ${itemInfo} - update to revision ${item.status.updateRevision}`)
      }
    }
    if (item.kind === 'Deployment') {
      logger.debug(`  - ${itemInfo} - ${item.status.replicas} pods`)
    }
    if (item.kind === 'Service') {
      if (item.status.loadBalancer && item.status.loadBalancer.ingress) {
        const ips = item.status.loadBalancer.ingress.map(i => i.ip).join(', ')
        logger.info(`  - ${itemInfo} - external IP(s) ${ips}`)
      }
    }
    if (item.kind === 'DaemonSet') {
      logger.debug(`  - ${itemInfo} - ${item.status.updatedNumberScheduled} pods`)
      if (item.status.updatedNumberScheduled !== item.status.desiredNumberScheduled) {
        logger.warn(`  - ${itemInfo} - updated ${item.status.updatedNumberScheduled} pods but there should be ${item.status.desiredNumberScheduled}`)
      }
    }
  }
  logger.debug(`Resources affected...`)
  logger.debug(itemInfos.join(', '))
}

function applyNamespaces (context, names) {
  const items = names.map(name => resources.namespace(name))
  const input = { apiVersion: 'v1', kind: 'List', items }
  try {
    var res = kubectl.apply(context, JSON.stringify(input))
  } catch (err) {
    err.message = `Failed to create Namespaces: ${err.message}`
    throw err
  }

  return res
}

function applyImagePullSecrets (context, secrets) {
  const input = { apiVersion: 'v1', kind: 'List', items: [] }
  for (const namespace in secrets) {
    for (const name in secrets[namespace]) {
      input.items.push(secrets[namespace][name])
    }
  }

  try {
    var res = kubectl.apply(context, JSON.stringify(input))
  } catch (err) {
    err.message = `Failed to create imagePullSecrets: ${err.message}`
    throw err
  }

  return res
}

function applyConfig (context, configs) {
  const input = { apiVersion: 'v1', kind: 'List', items: configs }

  try {
    var res = kubectl.apply(context, JSON.stringify(input))
  } catch (err) {
    err.message = `Failed to create ConfigMaps and Secrets: ${err.message}`
    throw err
  }

  return res
}

const resourceKeys = ['job', 'networkPolicy', 'deployment', 'cronJob', 'account', 'role', 'roleBinding', 'statefulSet', 'daemonSet']

function gatherResources (segment) {
  const gathered = []
  for (const key of resourceKeys) {
    if (segment.hasOwnProperty(key)) {
      gathered.push(segment[key])
    }
  }

  if (segment.services) {
    gathered.push(...segment.services)
  }

  return gathered
}

function applyLevel (options, spec, level) {
  const input = { apiVersion: 'v1', kind: 'List', items: [] }
  const names = spec.order[level]

  for (const name of names) {
    input.items.push(...gatherResources(spec.resources[name]))
  }

  options.logger.time(`level ${level}`)
  options.logger.info(`Applying level ${level} resources: ${names.join(', ')}`)
  try {
    var res = kubectl.apply(options.context, JSON.stringify(input))
  } catch (err) {
    err.message = `Failed to apply resources for level ${level}: ${err.message}`
    throw err
  }
  try {
    logResponse(options, res)
  } catch (err) {
    options.logger.error(`Error logging response from kubectl: ${err.message}`)
  }
  options.logger.timeEnd(`level ${level}`)

  return res
}

async function deploy (options) {
  try {
    var spec = await mcgonagall.transfigure(options.spec, options)
  } catch (err) {
    if (err.tokens) {
      throw new Error(`${err.tokens.length} tokens are referenced, but not defined: ${err.tokens.join(', ')}`)
    }

    err.message = `Failed to transfigure spec: ${err.message}`
    throw err
  }

  options.logger.info(`Applying namespaces: ${spec.namespaces.join(', ')}`)
  applyNamespaces(options.context, spec.namespaces)
  options.logger.info(`Applying pull secrets to ${Object.keys(spec.imagePullSecrets).join(', ')}`)
  applyImagePullSecrets(options.context, spec.imagePullSecrets)
  applyConfig(options.context, spec.configuration.concat(spec.secrets))
  for (const level of spec.levels) {
    applyLevel(options, spec, level)
  }
}

async function run (options) {
  try {
    var spec = await mcgonagall.transfigure(options.spec, options)
  } catch (err) {
    if (err.tokens) {
      throw new Error(`${err.tokens.length} tokens are referenced, but not defined: ${err.tokens.join(', ')}`)
    }

    err.message = `Failed to transfigure spec: ${err.message}`
    throw err
  }

  const [name, namespace, extra] = options.job.split('.')
  if (!namespace || extra) {
    throw new Error('job must be in the form of job.namespace')
  }
  if (!spec.resources.hasOwnProperty(options.job)) {
    throw new Error(`job ${options.job} does not exist in the spec`)
  }
  const job = spec.resources[options.job]
  const type = job.hasOwnProperty('cronJob') ? 'cronJob' : 'job'
  options.logger.info(`Deleting old ${type} "${name}"`)
  kubectl.del(options.context, namespace, type, name)
  options.logger.info(`Applying new ${type}`)
  const result = kubectl.apply(options.context, JSON.stringify(job[type]))
  options.logger.info(`Created new ${type} "${result.metadata.name}"`)
}

module.exports = {
  deploy,
  run
}
