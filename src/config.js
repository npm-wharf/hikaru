require('dot-env')
const path = require('path')
const fs = require('fs')
const URL = 'K8S_URL'
const HOST = 'K8S_HOST'
const VERSION = 'K8S_VERSION'
const TOKEN = 'K8S_TOKEN'
const CA = 'K8S_CA'
const CERT = 'K8S_CERT'
const KEY = 'K8S_KEY'
const USERNAME = 'K8S_USERNAME'
const PASSWORD = 'K8S_PASSWORD'
const LOG = 'K8S_LOG_LEVEL'

function readIfFile (value) {
  if (!value) return
  const filePath = path.resolve(value)
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8')
  }
  return value
}

module.exports = function () {
  let url = process.env[ URL ]
  if (!url) {
    url = `https://${process.env[ HOST ]}`
  }

  return {
    url: url,
    username: process.env[ USERNAME ],
    password: process.env[ PASSWORD ],
    version: process.env[ VERSION ] || '1.7',
    token: readIfFile(process.env[ TOKEN ]),
    caFile: process.env[ CA ],
    certFile: process.env[ CERT ],
    keyFile: process.env[ KEY ],
    ca: readIfFile(process.env[ CA ]),
    cert: readIfFile(process.env[ CERT ]),
    key: readIfFile(process.env[ KEY ]),
    transports: [ 'deftly-express' ],
    resources: [ './src/resources/*.js' ],
    plugins: [ './src/plugins/*.js' ],
    middleware: [ './src/middleware/*.js' ],
    logging: {
      level: process.env[LOG] || 'debug'
    }
  }
}
