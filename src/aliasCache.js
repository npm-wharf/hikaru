const fs = require('fs')
const log = require('bole')('aliasCache')

let cache = { aliases: {} }

function addAlias (filePath, alias, options) {
  const settings = {}
  Object.assign(settings, options)
  if (settings.user && settings.password) {
    const combined = [settings.user, settings.password].join(':')
    settings.credentials = Buffer.from(combined).toString('base64')
    delete settings.user
    delete settings.password
  }
  cache.aliases[alias] = settings
  save(filePath)
}

function getAlias (filePath, alias) {
  load(filePath)
  const settings = cache.aliases[alias]
  if (settings.credentials) {
    const combined = Buffer.from(settings.credentials, 'base64').toString('utf8')
    const [user, password] = combined.split(':')
    settings.user = user
    settings.password = password
    delete settings.credentials
  }
  return settings
}

function listAliases (filePath) {
  load(filePath)
  return Object.keys(cache.aliases)
}

function load (filePath) {
  try {
    const json = fs.readFileSync(filePath, 'utf8').toString()
    cache = JSON.parse(json)
  } catch (e) {
    log.error(`Failed to load the alias cache from '${filePath}': e.message`)
  }
}

function save (filePath) {
  try {
    const json = JSON.stringify(cache, null, 2)
    fs.writeFileSync(filePath, json, {encoding: 'utf8', mode: 0o600})
  } catch (e) {
    log.error(`Failed to save the alias cache to '${filePath}': e.message`)
  }
}

module.exports = function (filePath) {
  if (fs.existsSync(filePath)) {
    load(filePath)
  }
  return {
    cacheFile: filePath,
    addAlias: addAlias.bind(null, filePath),
    getAlias: getAlias.bind(null, filePath),
    listAliases: listAliases.bind(null, filePath),
    load: load.bind(null, filePath),
    save: save.bind(null, filePath)
  }
}
