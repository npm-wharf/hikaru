const _ = require('lodash')
const log = require('bole')('image-resource')

function getImage (data) {
  return _.filter([data.registry, data.repo, data.image]).join('/')
}

function getOptions (data) {
  if (data && data.filter) {
    return { filter: data.filter.split(',') }
  } else {
    return undefined
  }
}

module.exports = function (hikaru, config) {
  return {
    name: 'image',
    middleware: [
      'auth.bearer',
      'auth.cert'
    ],
    actions: {
      candidates: {
        method: 'GET',
        url: [ ':registry/:repo/:image', ':repo/:image', ':image' ],
        handle: (env) => {
          const image = getImage(env.data)
          const options = getOptions(env.data)
          const strOpts = options ? ` filter: [${options.filter.join(', ')}]` : 'no options'
          log.debug(`received request to find upgrade candidates for ${image} with ${strOpts}`)
          return hikaru.getCandidates(image, options)
            .then(
              result => {
                return { data: result }
              },
              err => {
                log.error(`Failed to retrieve upgrade candidates using the image '${image}' from the cluster '${config.url}':\n\t${err.message}`)
                return {
                  status: 500,
                  data: {
                    error: `Failed to retrieve upgrade candidates using the image '${image}' from the cluster '${config.url}'`,
                    reason: err.stack
                  }
                }
              })
        }
      },
      upgrade: {
        method: 'POST',
        url: [ ':registry/:repo/:image', ':repo/:image', ':image' ],
        handle: (env) => {
          const image = getImage(env.data)
          log.debug(`received request to upgrade ${image}`)
          return hikaru.upgradeImage(image)
            .then(
              result => {
                log.info(`upgraded resources with ${image}:\n\t${JSON.stringify(result, null, 2)}`)
                return { data: result }
              },
              err => {
                log.error(`Failed to upgrade resources using the image '${image}' from the cluster '${config.url}':\n\t${err.message}`)
                return {
                  status: 500,
                  data: {
                    error: `Failed to upgrade resources using the image '${image}' from the cluster '${config.url}'`,
                    reason: err.message
                  }
                }
              })
        }
      }
    }
  }
}
