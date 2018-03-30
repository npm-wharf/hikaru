const path = require('path')
const rimraf = require('rimraf')
const log = require('bole')('image-resource')
const GITHUB_PREFIX = /^(https:[/][/]|git:[/][/]|git@)/

function getRepoUrl (data) {
  const url = [data.registry, data.owner, data.repo].join('/')
  let full = url
  if (!GITHUB_PREFIX.test(full)) {
    full = `git://${full}`
  }
  return full
}

function deployFromGit (config, hikaru, data, body) {
  const url = getRepoUrl(data)
  log.debug(`received request to deploy '${url}' to '${config.url}'`)
  return hikaru.deployCluster(
    url,
    {
      branch: data.branch,
      data: body,
      version: config.version
    }
  ).then(
    result => {
      return { data: result }
    },
    err => {
      if (err.tokens) {
        log.warn(`received request to deploy '${url}' to '${config.url}' with missing tokens:\n\t'[${err.tokens.join(', ')}]'`)
        return {
          status: 400,
          data: {
            message: `Failed to deploy '${url}' to '${config.url}' - ${err.tokens.length} tokens missing`,
            reason: err.message,
            tokens: err.tokens
          }
        }
      } else {
        log.error(`failed to deploy '${url}' to ${config.url} with error:\n\t${err.message}`)
        return {
          status: 500,
          data: {
            message: `Failed to deploy '${url}' to '${config.url}'`,
            reason: err.message
          }
        }
      }
    }
  )
}

function removeFromGit (config, hikaru, data, body) {
  const url = getRepoUrl(data)
  log.debug(`received request to remove '${url}' from ${config.url}`)
  return hikaru.removeCluster(
    url,
    {
      branch: data.branch,
      data: body,
      version: config.version
    }
  ).then(
    result => {
      return { data: result }
    },
    err => {
      if (err.tokens) {
        log.warn(`received request to remove '${url}' from '${config.url}' with missing tokens:\n\t'[${err.tokens.join(', ')}]'`)
        return {
          status: 400,
          data: {
            message: `Failed to remove '${url}' from '${config.url}' - ${err.tokens.length} tokens missing`,
            reason: err.message,
            tokens: err.tokens
          }
        }
      } else {
        log.error(`failed to remove '${url}' from '${config.url}' with error:\n\t${err.message}`)
        return {
          status: 500,
          data: {
            message: `Failed to remove '${url}' from '${config.url}'`,
            reason: err.message
          }
        }
      }
    }
  )
}

function deployFromTar (config, hikaru, env) {
  log.debug(`received request to deploy '${env.file}' to '${config.url}'`)
  return hikaru.deployCluster(
    env.filePath,
    {
      data: env.fields,
      version: config.version
    }
  ).then(
    result => {
      rimraf.sync(path.dirname(env.filePath))
      return { data: result }
    },
    err => {
      rimraf.sync(path.dirname(env.filePath))
      if (err.tokens) {
        log.warn(`received request to deploy '${env.file}' to '${config.url}' with missing tokens:\n\t'[${err.tokens.join(', ')}]'`)
        return {
          status: 400,
          data: {
            message: `Failed to deploy '${env.file}' to '${config.url}' - ${err.tokens.length} tokens missing`,
            reason: err.message,
            tokens: err.tokens
          }
        }
      } else {
        log.error(`failed to deploy '${env.file}' to '${config.url}' with error:\n\t${err.message}`)
        return {
          status: 500,
          data: {
            message: `Failed to deploy '${env.file}' to '${env.file}'`,
            reason: err.message
          }
        }
      }
    }
  )
}

function removeFromTar (config, hikaru, env) {
  log.debug(`received request to remove '${env.file}' from '${config.url}'`)
  return hikaru.removeCluster(
    env.filePath,
    {
      data: env.fields,
      version: config.version
    }
  ).then(
    result => {
      rimraf.sync(path.dirname(env.filePath))
      return { data: result }
    },
    err => {
      rimraf.sync(path.dirname(env.filePath))
      if (err.tokens) {
        log.warn(`received request to remove '${env.file}' from '${config.url}' with missing tokens:\n\t'[${err.tokens.join(', ')}]'`)
        return {
          status: 400,
          data: {
            message: `Failed to remove '${env.file}' from '${config.url}' - ${err.tokens.length} tokens missing`,
            reason: err.message,
            tokens: err.tokens
          }
        }
      } else {
        log.error(`failed to remove '${env.file}' from '${config.url}' with error:\n\t${err.message}`)
        return {
          status: 500,
          data: {
            message: `Failed to remove '${env.file}' from '${env.file}'`,
            reason: err.message
          }
        }
      }
    }
  )
}

module.exports = function (hikaru, config) {
  return {
    name: 'cluster',
    middleware: [
      'auth.bearer',
      'auth.cert'
    ],
    actions: {
      deploy: {
        method: 'POST',
        middleware: [
          'file.upload'
        ],
        url: [ '', ':registry/:owner/:repo', ':/registry/:owner/:repo/:branch' ],
        handle: (env) => {
          if (env.data.registry) {
            return deployFromGit(config, hikaru, env.data, env.body)
          } else {
            return deployFromTar(config, hikaru, env)
          }
        }
      },
      remove: {
        method: 'DELETE',
        middleware: [
          'file.upload'
        ],
        url: [ '/', ':registry/:owner/:repo', ':/registry/:owner/:repo/:branch' ],
        handle: (env) => {
          if (env.data.registry) {
            return removeFromGit(config, hikaru, env.data, env.body)
          } else {
            return removeFromTar(config, hikaru, env)
          }
        }
      }
    }
  }
}
