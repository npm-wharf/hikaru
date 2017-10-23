const deftly = require('deftly')

function start (config) {
  return deftly
    .init(config)
    .then((service) => {
      service.start()
      return service
    })
}

module.exports = {
  start: start
}
