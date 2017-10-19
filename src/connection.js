const K8sClient = require('auto-kubernetes-client')
const log = require('bole')('connection')

function getClient (config) {
  validate(config)
  const connection = {
    url: config.url
  }
  let creds = ''

  if (config.username && config.password) {
    connection.auth = {
      user: config.username,
      password: config.password
    }
    if (config.ca) {
      Object.assign(connection, {
        agentOptions: {
          ca: config.ca
        }
      })
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
      connection.insecureSkipTlsVerify = true
    }
    creds = 'username and password'
  } else if (config.token) {
    connection.auth = {
      bearer: config.token
    }
    if (config.ca) {
      Object.assign(connection, {
        agentOptions: {
          ca: config.ca
        }
      })
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
      connection.insecureSkipTlsVerify = true
    }
    creds = 'bearer token'
  } else {
    connection.ca = config.ca
    connection.cert = config.cert
    connection.key = config.key
    creds = 'cluster certificates'
  }

  log.debug(`connecting to '${connection.url}' ...`)
  return K8sClient(connection)
    .then(
      client => {
        client.saveDiffs = config.saveDiffs
        return client
      },
      err => {
        log.error(`could not connect to '${connection.url}':\n\t${err.message}`)
        throw new Error(`failed to connect to Kubernetes cluster '${config.url}' with ${creds}:\n\t'${err.message}'`)
      }
    )
}

function validate (config) {
  if (config.username || config.password) {
    if (!config.username) {
      throw new Error('Cannot authenticate to Kubernetes cluster via basic auth without a valid username')
    }
    if (!config.password) {
      throw new Error('Cannot authenticate to Kubernetes cluster via basic auth without a valid password')
    }
  } else if (!config.token) {
    if (!config.ca) {
      throw new Error('Cannot authenticate to Kubernetes cluster via certificates without a valid CA')
    }
    if (!config.cert) {
      throw new Error('Cannot authenticate to Kubernetes cluster via certificates without a valid client cert')
    }
    if (!config.key) {
      throw new Error('Cannot authenticate to Kubernetes cluster via certificates without a valid client key')
    }
  }
}

module.exports = {
  getClient: getClient
}
