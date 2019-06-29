'use strict'

const { spawnSync } = require('child_process')

function version (context) {
  const res = spawnSync('kubectl', [`--context=${context}`, 'version', '-ojson'])
  if (res.error) {
    throw res.error
  }

  return JSON.parse(res.stdout)
}

function apply (context, input) {
  const res = spawnSync('kubectl', [`--context=${context}`, 'apply', '-f', '-', '-ojson'], { input })

  if (res.error) {
    res.error.output = res.stderr.toString()
    throw res.error
  }

  try {
    return JSON.parse(res.stdout)
  } catch (err) {
    console.error(res.stderr.toString())
    throw new Error(res.stderr.toString())
  }
}

module.exports = {
  apply,
  version
}
