const fetch = require('node-fetch')
const log = require('bole')('hikaru.version')

async function getVersion (config) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  const encoded = Buffer.from(`${config.username}:${config.password}`).toString('base64')
  try {
    log.info(`attempting to determine API version of master node '${config.url}' ...`)
    const result = await fetch(`${config.url}/version`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${encoded}`
      },
      timeout: 2000
    })
    if (result.status >= 200 && result.status < 400) {
      const { major, minor, gitVersion } = await result.json()
      const version = `${major}.${minor.toString().replace(/[^0-9]/g, '')}`
      log.info(`API version of master node '${config.url}' is ${version} with running software reported as '${gitVersion}'`)
      return version
    }
    log.error(`failed to determine API version of master node '${config.url}' - ${result.status}: ${result.statusText}`)
    throw new Error(`Could not connect to '${config.url}' with ${result.status}: ${result.statusText}`)
  } catch (e) {
    log.error(`failed to determine API version of master node '${config.url}' due to connection error: ${e.message}`)
    throw new Error(`Could not connect to '${config.url}' with error: ${e.message}`)
  }
}

module.exports = {
  getVersion
}
