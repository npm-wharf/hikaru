const fs = require('fs')
const path = require('path')
const Promise = require('bluebird')
const inquirer = require('inquirer')
const toml = require('toml-j0.4')
const yaml = require('js-yaml')

const SECRET_RGX = /(pass$|password|passwd|secret|secrt|scrt|secure)/i

const prompt = inquirer.createPromptModule()

function acquireTokens (tokens) {
  return Promise.mapSeries(tokens, (token) => {
    const type = SECRET_RGX.test(token) ? 'password' : 'input'
    return prompt({
      type: type,
      name: token,
      message: `'${token}'`,
      validate: (x) => {
        if (x === '' || x === undefined || x === null) {
          return 'Please provide a value for the token.'
        }
        return true
      }
    })
  }).then(list => {
    return list.reduce((acc, answer) => {
      Object.assign(acc, answer)
      return acc
    }, {})
  })
}

function loadTokens (file) {
  const tokenFile = path.resolve(file)
  if (fs.existsSync(tokenFile)) {
    const raw = fs.readFileSync(tokenFile, 'utf8')
    try {
      switch (path.extname(tokenFile)) {
        case '.toml':
          return toml.parse(raw)
        case '.json':
          return JSON.parse(raw)
        case '.yml':
        case '.yaml':
          return yaml.safeLoad(raw)
      }
    } catch (e) {
      console.log(`The token file '${tokenFile}' threw an error when parsing. Proceeding without it.`)
    }
  } else {
    console.log(`The token file '${tokenFile}' does not exist or could not be read. Proceeding without it.`)
  }
}

module.exports = {
  acquireTokens: acquireTokens,
  loadTokens: loadTokens
}
