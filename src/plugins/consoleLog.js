const bole = require('bole')
const chalk = require('chalk')

const levelColors = {
  debug: 'gray',
  info: 'white',
  warn: 'yellow',
  error: 'red'
}

const levels = {
  1: 'error',
  2: 'warn',
  3: 'info',
  4: 'debug',
  'error': 'error',
  'warn': 'warn',
  'info': 'info',
  'debug': 'debug'
}

const numeric = {
  'error': 1,
  'warn': 2,
  'info': 3,
  'debug': 4
}

const debugOut = {
  write: function (data) {
    const entry = JSON.parse(data)
    const levelColor = levelColors[entry.level]
    console.log(`${chalk[levelColor](entry.time)} - ${chalk[levelColor](entry.level)} ${entry.message}`)
  }
}

function initialize (service) {
  bole.output({
    level: levels[service.config.logging.level],
    stream: debugOut
  })

  service.log.addAdapter(
    { level: numeric[service.config.logging.level] },
    entry => {
      bole(entry.namespace)[levels[entry.level]](`  ${entry.namespace} [${entry.type}]: ${entry.message}`)
    }
  )
}

module.exports = function consoleLog () {
  return {
    initialize: initialize
  }
}
