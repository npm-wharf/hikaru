const mcgonagall = require('@npm-wharf/mcgonagall')
const connection = require('./connection')
const log = require('bole')('hikaru')
const fount = require('fount')
const _ = require('lodash')

fount.register('cluster', require('./cluster'))
fount.register('k8s', require('./k8s'))
fount.register('client', (config) => {
  return connection.getClient(config)
    .then(
      null,
      err => {
        log.error(err.message)
        return null
      }
    )
})
fount.register('config', require('./config')())

function aliasCluster (aliasCache, options) {
  return onCluster(cluster => {
    if (cluster) {
      return cluster.getNamespaces()
        .then(
          () => {
            aliasCache.addAlias(options.alias, options)
          }
        )
    }
  })
}

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
      .then(
        cluster => {
          api.cluster = cluster
          api.k8s = cluster.k8s
          return fn(cluster)
        },
        err => {
          throw new Error(err.message)
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
  aliasCluster: aliasCluster,
  deployCluster: deployCluster,
  findResources: findResources,
  getCandidates: getCandidates,
  removeCluster: removeCluster,
  upgradeImage: upgradeImage
}

module.exports = api
