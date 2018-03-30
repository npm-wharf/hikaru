const _ = require('lodash')
const log = require('bole')('image-resource')

function getImage (data) {
  return _.filter([data.registry, data.repo, data.image]).join('/')
}

module.exports = function (hikaru, config) {
  return {
    name: 'resource',
    middleware: [
      'auth.bearer',
      'auth.cert'
    ],
    actions: {
      search: {
        method: 'GET',
        url: [ '/', ':registry/:repo/:image', ':repo/:image', ':image' ],
        handle: (env) => {
          const image = getImage(env.data)
          const filter = Object.assign({}, env.data, {image})
          const json = JSON.stringify(filter, null, 2)
          log.debug(`received request to find resources matching '${json}'`)
          return hikaru.findResources(image)
            .then(
              result => {
                return { data: result }
              },
              err => {
                log.error(`Failed to retrieve resources using the filter '${json}' from the cluster '${config.url}':\n\t${err.message}`)
                return {
                  status: 500,
                  data: {
                    error: `Failed to retrieve resources using the filter '${json}' from the cluster '${config.url}'`,
                    reason: err.message
                  }
                }
              })
        }
      }
    }
  }
}
