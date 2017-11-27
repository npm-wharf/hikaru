const bole = require('bole')

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
    }
  }
}

function handle (config, hikaru, readFile, aliasCache, debugOut, argv) {
  config.alias = argv.name
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

  bole.output({
    level: argv.verbose ? 'debug' : 'info',
    stream: debugOut
  })

  hikaru.aliasCluster(aliasCache, config)
    .then(
      () => console.log(`Alias '${config.alias}' for '${config.url}' was written to '${aliasCache.cacheFile}' successfully.`),
      () => {
        console.error(`There was a problem connecting to '${config.url}' with the information provided, alias was not created.`)
        process.exit(100)
      }
    )
}

module.exports = function (config, hikaru, readFile, aliasCache, debugOut) {
  return {
    command: 'alias <name> [options]',
    desc: 'creates an alias for a kubernetes cluster and its auth for use in other commands',
    builder: build(config),
    handler: handle.bind(null, config, hikaru, readFile, aliasCache, debugOut)
  }
}
