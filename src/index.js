
const mcgonagall = require('mcgonagall')
const connection = require('./connection')
const log = require('bole')('hikaru')
const fount = require('fount')
const _ = require('lodash')

fount.register('cluster', require('./cluster'))
fount.register('k8s', require('./k8s'))
fount.register('client', (config) => { return connection.getClient(config) })
fount.register('config', require('./config')())

function deployCluster (path) {
  return fount.inject(cluster => {
    return mcgonagall.transfigure(path)
      .then(
        spec => {
          log.info('transfiguration complete')
          return cluster.deployCluster(spec)
        }
      )
  })
}

function findResources (criteria) {
  return fount.inject(cluster => {
    if (_.isString(criteria)) {
      return cluster.findResourcesByImage(criteria)
    } else {
      return cluster.findResourcesByMetadata(criteria)
    }
  })
}

function getCandidates (image, options) {
  return fount.inject(cluster => {
    return cluster.getUpgradeCandidates(image, options)
  })
}

function removeCluster (path) {
  return fount.inject(cluster => {
    return mcgonagall.transfigure(path)
      .then(
        spec => {
          log.info('transfiguration complete')
          return cluster.removeCluster(spec)
        }
      )
  })
}

function upgradeImages (image, options) {
  return fount.inject(cluster => {
    return cluster.upgradeResources(image, options)
  })
}

module.exports = {
  deployCluster: deployCluster,
  findResources: findResources,
  getCandidates: getCandidates,
  removeCluster: removeCluster,
  upgradeImage: upgradeImages
}
