const bole = require('bole')

function build (config) {
  return {
    url: {
      alias: 'k',
      describe: 'url to the kubernetes cluster',
      default: config.url,
      demandOption: !config.url
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
      default: false,
      boolean: true
    },
    saveDiffs: {
      alias: 's',
      describe: 'if deploying a cluster over an existing one, save any differences that exist between existing resources and deployed ones in a `./diff` folder',
      default: false,
      boolean: true
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
  config.saveDiffs = argv.saveDiffs

  bole.output({
    level: argv.debug ? 'debug' : 'info',
    stream: debugOut
  })

  hikaru.deployCluster(argv.source)
    .then(
      () => console.log('done'),
      err => console.log('error', err)
    )
}

module.exports = function (config, hikaru, readFile, debugOut) {
  return {
    command: 'create <source> [options]',
    desc: 'creates a cluster based on the source specification',
    builder: build(config),
    handler: handle.bind(null, config, hikaru, readFile, debugOut)
  }
}
