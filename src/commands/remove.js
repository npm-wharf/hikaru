const bole = require('bole')
const inquire = require('./inquire')

function build (config) {
  return {
    url: {
      alias: 'k',
      describe: 'url to the kubernetes cluster',
      default: config.url,
      demandOption: !config.url
    },
    apiVersion: {
      alias: 'v',
      describe: 'kubernetes cluster API version',
      default: '1.7'
    },
    user: {
      alias: 'u',
      describe: 'username for basic authentication to the cluster',
      default: config.username
    },
    password: {
      alias: 'p',
      describe: 'password for basic authentication to the cluster',
      default: config.password
    },
    token: {
      alias: 't',
      describe: 'bearer token to use for authentication to the cluster'
    },
    ca: {
      describe: 'path to the CA file for the cluster',
      default: config.caFile
    },
    cert: {
      describe: 'path to the cert file to authenticate the client',
      default: config.certFile
    },
    key: {
      describe: 'path to the key file to authenticate the client',
      default: config.keyFile
    },
    debug: {
      alias: 'd',
      describe: 'show debug output in logging',
      default: false
    }
  }
}

function handle (config, hikaru, readFile, debugOut, argv) {
  if (argv.ca) {
    config.ca = readFile(argv.ca)
  }
  if (argv.cert) {
    config.cert = readFile(argv.cert)
  }
  if (argv.key) {
    config.key = readFile(argv.key)
  }
  if (argv.user) {
    config.username = argv.user
  }
  if (argv.password) {
    config.password = argv.password
  }
  if (argv.token) {
    config.token = argv.token
  }
  if (argv.url) {
    config.url = argv.url
  }
  if (argv.apiVersion) {
    config.version = argv.apiVersion
  }
  const options = {
    version: config.version
  }

  if (argv.tokenFile) {
    options.data = inquire.loadTokens(argv.tokenFile)
  }

  bole.output({
    level: argv.debug ? 'debug' : 'info',
    stream: debugOut
  })

  hikaru.removeCluster(argv.source, options)
    .then(
      () => console.log('done'),
      err => {
        if (err.tokens) {
          console.log(`${err.tokens.length} tokens were found in the specification. When prompted, please provide a value for each.`)
          inquire.acquireTokens(err.tokens)
            .then(
              tokens => {
                return hikaru.removeCluster(err.specPath, {
                  data: tokens
                })
              }
            )
        } else {
          console.error(`There was a problem in the specification at '${argv.source}'.\n ${err}`)
          process.exit(100)
        }
      }
    )
}

module.exports = function (config, hikaru, readFile, debugOut) {
  return {
    command: 'remove <source> [options]',
    desc: 'removes the source specification from a kubernetes cluster',
    builder: build(config),
    handler: handle.bind(null, config, hikaru, readFile, debugOut)
  }
}
