const _ = require('lodash')
const log = require('bole')('workload-resource')

function getImage (data) {
  return _.filter([data.registry, data.repo, data.image]).join('/')
}

module.exports = function (hikaru, config) {
  return {
    name: 'workload',
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
          log.debug(`received request to find workloads matching '${json}'`)
          return hikaru.findResources(image)
            .then(
              result => {
                return { data: result }
              },
              err => {
                log.error(`Failed to retrieve workloads using the filter '${json}' from the cluster '${config.url}':\n\t${err.stack}`)
                return {
                  status: 500,
                  data: {
                    error: `Failed to retrieve workloads using the filter '${json}' from the cluster '${config.url}'`,
                    reason: err.message
                  }
                }
              })
        }
      }
    }
  }
}
