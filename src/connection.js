const K8Api = require('kubernetes-client')

function getClient (api, config) {
  let clientMethod
  if (config.username && config.password) {
    if (config.ca) {
      clientMethod = getClientWithBasicAuthAndCert
    } else {
      clientMethod = getClientWithBasicAuthNoCert
    }
  } else if (config.token) {
    clientMethod = getClientWithTokenAuth
  } else {
    clientMethod = getClientWithCert
  }
  return clientMethod(config, api)
}

function getClientWithBasicAuthNoCert (config, api) {
  return new K8Api[ api ]({
    url: config.url,
    insecureSkipTlsVerify: true,
    auth: {
      user: config.username,
      pass: config.password
    }
  })
}

function getClientWithBasicAuthAndCert (config, api) {
  return new K8Api[ api ]({
    url: config.url,
    ca: config.ca,
    auth: {
      user: config.username,
      pass: config.password
    }
  })
}

function getClientWithTokenAuth (config, api) {
  return new K8Api[ api ]({
    url: config.url,
    auth: {
      bearer: config.token
    }
  })
}

function getClientWithCert (config, api) {
  return new K8Api[ api ]({
    url: config.url,
    ca: config.ca,
    cert: config.cert,
    key: config.key
  })
}

module.exports = {
  getCoreClient: getClient.bind(null, 'Core'),
  getExtensionClient: getClient.bind(null, 'Extensions')
}
