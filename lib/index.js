'use strict'

const mcgonagall = require('@npm-wharf/mcgonagall')

const kubectl = require('./kubectl')
const resources = require('./resources')

function logResponse(res) {
  if (res.kind !== 'List') {
    res = { kind: 'List', apiVersion: 'v1', metadata: {}, items: [res] }
  }

  if (res.items.length === 0) {
    return 'No items returned from kubectl'
  }

  const output = res.items.map((item) => {
    let msg = `  - ${item.kind}: ${item.metadata.name}.${item.metadata.namespace}`
    if (item.status) {
      if (item.status.currentRevision) {
        if (item.status.currentRevision === item.status.updateRevision) {
          msg = `${msg} - unchanged`
        }
        else {
          msg = `${msg} - update to revision ${item.status.updateRevision}`
        }
      }
      if (item.status.hasOwnProperty('replicas') && item.status.hasOwnProperty('updatedReplicas')) {
        msg = `${msg} - updated ${item.status.updatedReplicas} of ${item.status.replicas} replicas`
      }
      if (item.status.loadBalancer && item.status.loadBalancer.ingress) {
        const ips = item.status.loadBalancer.ingress.map((i => i.ip)).join(', ')
        msg = `${msg} - external IP(s) ${ips}`
      }
      if (item.status.hasOwnProperty('updatedNumberScheduled') && item.status.hasOwnProperty('desiredNumberScheduled')) {
        msg = `${msg} - updated ${item.status.updatedNumberScheduled} of ${item.status.desiredNumberScheduled}`
      }
    }
    return msg
  })

  return output.join('\n')
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
  const resources = []
  for (const key of resourceKeys) {
    if (segment.hasOwnProperty(key)) {
      resources.push(segment[key])
    }
  }

  if (segment.services) {
    resources.push(...segment.services)
  }

  return resources
}

function applyLevel (context, spec, level) {
  const input = { apiVersion: 'v1', kind: 'List', items: [] }
  const names = spec.order[level]

  for (const name of names) {
    input.items.push(...gatherResources(spec.resources[name]))
  }

  console.time(`Level ${level} run time`)
  console.log(`Applying level ${level} resources: ${names.join(', ')}`)
  try {
    var res = kubectl.apply(context, JSON.stringify(input))
  } catch (err) {
    err.message = `Failed to apply resources for level ${level}: ${err.message}`
    throw err
  }
  console.log(logResponse(res))
  console.timeEnd(`Level ${level} run time`)

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

  console.log(`Applying namespaces: ${spec.namespaces.join(', ')}`)
  applyNamespaces(options.context, spec.namespaces)
  console.log(`Applying pull secrets to ${Object.keys(spec.imagePullSecrets).join(', ')}`)
  applyImagePullSecrets(options.context, spec.imagePullSecrets)
  applyConfig(options.context, spec.configuration.concat(spec.secrets))
  for (const level of spec.levels) {
    applyLevel(options.context, spec, level)
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
  console.log(`Deleting old ${type} "${name}"`)
  kubectl.del(options.context, namespace, type, name)
  console.log(`Applying new ${type}`);
  const result = kubectl.apply(options.context, JSON.stringify(job[type]))
  console.log(`Created new ${type} "${result.metadata.name}"`)
}

module.exports = {
  deploy,
  run
}
