function initialize (service, config) {
  service.log.addAdapter(
    { level: service.config.logging.level },
    (entry) => console.log(`  ${entry.namespace} [${entry.type}]: ${entry.message}`)
  )
}

module.exports = function consoleLog () {
  return {
    initialize: initialize
  }
}
