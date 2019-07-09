'use strict'

const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const Logger = require('@nlf/cli-logger')

const hikaru = require('../../lib')
const kubectl = require('../../lib/kubectl')

exports.command = 'run <spec>'
exports.description = 'run a job from a spec on a cluster'
exports.builder = function (yargs) {
  return yargs
    .option('context', {
      alias: 'c',
      description: 'kubectl alias for cluster',
      demandOption: true
    })
    .option('job', {
      alias: 'j',
      description: 'job to run in format job.namespace',
      demandOption: true
    })
    .option('scale', {
      alias: 's',
      description: 'scale factor to apply to the cluster'
    })
    .option('tokenFile', {
      alias: 'f',
      description: 'path to file containing tokens to be applied to the spec'
    })
    .option('verbose', {
      alias: 'v',
      type: 'boolean',
      description: 'verbose mode, extra logging output'
    })
}

exports.handler = async function (argv) {
  const options = {
    context: argv.context,
    job: argv.job,
    spec: argv.spec
  }
  const logOptions = {
    name: 'hikaru'
  }
  if (argv.verbose) {
    logOptions.level = 'debug'
  }

  const logger = new Logger(logOptions)
  options.logger = new Logger(logger)
  logger.time('running')

  try {
    const version = kubectl.version(options.context)
    options.version = `${version.serverVersion.major}.${version.serverVersion.minor.replace(/[^0-9]/g, '')}`
  } catch (err) {
    logger.error(err.message)
    logger.timeEnd('running')
    process.exitCode = 1
    return
  }

  if (argv.tokenFile) {
    try {
      options.data = yaml.safeLoad(fs.readFileSync(path.resolve(argv.tokenFile), { encoding: 'utf8' }))
    } catch (err) {
      logger.error(err.message)
      logger.timeEnd('running')
      process.exitCode = 1
      return
    }
  }

  if (argv.scale) {
    options.scale = argv.scale
  }

  try {
    await hikaru.run(options)
  } catch (err) {
    logger.error(err.message)
    process.exitCode = 1
  }
  logger.timeEnd('running')
}
