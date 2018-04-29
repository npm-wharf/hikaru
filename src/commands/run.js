const bole = require('bole')
const inquire = require('./inquire')

function build (config, aliasCache) {
  return {
    alias: {
      alias: 'a',
      describe: 'an alias for a kubernetes cluster that hikaru has credentials for',
      choices: aliasCache.listAliases()
    },
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
    verbose: {
      describe: 'output verbose logging (shows status checks)',
      default: false,
      boolean: true
    },
    scale: {
      alias: 's',
      describe: 'choose a scale factor to apply (if available) for the cluster',
      type: 'string'
    },
    saveDiffs: {
      alias: 'd',
      describe: 'if deploying a cluster over an existing one, save any differences that exist between existing resources and deployed ones in a `./diff` folder',
      default: false,
      boolean: true
    },
    tokenFile: {
      alias: 'f',
      describe: 'supply a key/value file for any tokens in the specification'
    },
    job: {
      alias: 'j',
      describe: 'the job name (including namespace) to run in the cluster - will delete previously existing job to force run',
      demandOption: true
    }
  }
}

function handle (config, hikaru, readFile, aliasCache, debugOut, argv) {
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
  if (argv.scale) {
    config.scale = argv.scale
  }
  if (argv.alias) {
    const cached = aliasCache.getAlias(argv.alias)
    Object.assign(config, cached)
  }

  config.saveDiffs = argv.saveDiffs

  const options = {
    version: config.version
  }

  if (argv.tokenFile) {
    options.data = inquire.loadTokens(argv.tokenFile)
  }
  if (config.scale) {
    options.scale = config.scale
  }
  if (!argv.job || !/[.]/.test(argv.job)) {
    console.log(`the job name is required and must include the namespace and job name in 'namespace.job' format`)
    process.exit(-1)
  } else {
    const [ namespace, jobName ] = argv.job.split('.')
    options.namespace = namespace
    options.job = jobName
  }

  bole.output({
    level: argv.verbose ? 'debug' : 'info',
    stream: debugOut
  })

  hikaru.runJob(argv.source, options)
    .then(
      () => console.log('done'),
      err => {
        if (err.tokens) {
          console.log(`${err.tokens.length} tokens were found in the specification. When prompted, please provide a value for each.`)
          return inquire.acquireTokens(err.tokens)
            .then(
              tokens => {
                if (options.data !== undefined) {
                  options.data = Object.assign(options.data, tokens)
                } else {
                  options.data = tokens
                }
                return hikaru.deployCluster(err.specPath, {
                  data: options.data
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

module.exports = function (config, hikaru, readFile, aliasCache, debugOut) {
  return {
    command: 'run <source> [options]',
    desc: 'forces a job from the specification to run on the kubernetes cluster',
    builder: build(config, aliasCache),
    handler: handle.bind(null, config, hikaru, readFile, aliasCache, debugOut)
  }
}
