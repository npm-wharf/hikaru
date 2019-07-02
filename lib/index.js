'use strict'

const mcgonagall = require('@npm-wharf/mcgonagall')

const kubectl = require('./kubectl')
const resources = require('./resources')

function applyNamespaces (context, names) {
  const items = names.map(name => resources.namespace(name))
  try {
    var res = kubectl.apply(context, JSON.stringify({ apiVersion: 'v1', kind: 'List', items }))
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

  try {
    console.log(`Applying level ${level} resources: ${names.join(', ')}`)
    var res = kubectl.apply(context, JSON.stringify(input))
  } catch (err) {
    err.message = `Failed to apply resources for level ${level}: ${err.message}`
    throw err
  }

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

  const [name, namespace] = options.job.split('.')
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