const mcgonagall = require('mcgonagall')
const connection = require('./connection')
const log = require('bole')('hikaru')
const fount = require('fount')
const _ = require('lodash')

fount.register('cluster', require('./cluster'))
fount.register('k8s', require('./k8s'))
fount.register('client', (config) => { return connection.getClient(config) })
fount.register('config', require('./config')())

function deployCluster (path, options) {
  return onCluster(cluster => {
    return mcgonagall.transfigure(path, options)
      .then(
        spec => {
          log.info('transfiguration complete')
          return cluster.deployCluster(spec)
        }
      )
  })
}

function findResources (criteria) {
  return onCluster(cluster => {
    if (_.isString(criteria)) {
      return cluster.findResourcesByImage(criteria)
    } else {
      return cluster.findResourcesByMetadata(criteria)
    }
  })
}

function onCluster (fn) {
  if (api.cluster) {
    return fn(api.cluster)
  } else {
    return fount.resolve('cluster')
      .then(cluster => {
        api.cluster = cluster
        api.k8s = cluster.k8s
        return fn(cluster)
      })
  }
}

function getCandidates (image, options) {
  return onCluster(cluster => {
    return cluster.getUpgradeCandidates(image, options)
  })
}

function removeCluster (path, options) {
  return onCluster(cluster => {
    return mcgonagall.transfigure(path, options)
      .then(
        spec => {
          log.info('transfiguration complete')
          return cluster.removeCluster(spec)
        }
      )
  })
}

function upgradeImage (image, options) {
  return onCluster(cluster => {
    return cluster.upgradeResources(image, options)
  })
}

const api = {
  connect: () => {
    return onCluster(() => {}).then(() => api)
  },
  deployCluster: deployCluster,
  findResources: findResources,
  getCandidates: getCandidates,
  removeCluster: removeCluster,
  upgradeImage: upgradeImage
}

module.exports = api
