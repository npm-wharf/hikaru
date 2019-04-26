const mcgonagall = require('@npm-wharf/mcgonagall')
const connection = require('./connection')
const fount = require('fount')
const log = require('bole')('hikaru')
const _ = require('lodash')

fount.register('cluster', require('./cluster'))
fount.register('k8s', require('./k8s'))
fount.register('client', config => {
  return connection.getClient(config)
    .catch(err => {
      log.error(err.message)
      return null
    })
})
fount.register('config', require('./config')())

async function getCluster () {
  if (api.cluster) return api.cluster

  const cluster = await fount.resolve('cluster')
  api.cluster = cluster
  api.k8s = cluster.k8s
  return cluster
}

async function aliasCluster (aliasCache, options) {
  const cluster = await getCluster()
  if (!cluster) return
  await cluster.getNamespaces()
  return aliasCache.addAlias(options.alias, options)
}

async function deployCluster (path, options, extraConfig = {}) {
  const config = await fount.resolve('config')
  Object.assign(config, extraConfig)
  const cluster = await getCluster()
  const spec = await mcgonagall.transfigure(path, options)
  log.info('transfiguration complete')
  await cluster.deployCluster(spec)
}

async function findResources (criteria) {
  const cluster = await getCluster()
  if (_.isString(criteria)) {
    return cluster.findResourcesByImage(criteria)
  } else {
    return cluster.findResourcesByMetadata(criteria)
  }
}

async function getCandidates (image, options) {
  const cluster = await getCluster()
  return cluster.getUpgradeCandidates(image, options)
}

async function removeCluster (path, options) {
  const cluster = await getCluster()
  const spec = await mcgonagall.transfigure(path, options)
  log.info('transfiguration complete')
  await cluster.removeCluster(spec)
}

async function runJob (path, options) {
  const cluster = await getCluster()
  const spec = await mcgonagall.transfigure(path, options)
  log.info('transfiguration complete')
  await cluster.runJob(spec, options.namespace, options.job)
}

async function upgradeImage (image, options) {
  const cluster = await getCluster()
  await cluster.upgradeResources(image, options)
}

const api = {
  connect: async () => {
    await getCluster()
    return api
  },
  aliasCluster: aliasCluster,
  deployCluster: deployCluster,
  findResources: findResources,
  getCandidates: getCandidates,
  removeCluster: removeCluster,
  runJob: runJob,
  upgradeImage: upgradeImage
}

module.exports = api
