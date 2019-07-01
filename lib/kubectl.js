'use strict'

const { spawnSync } = require('child_process')

function apply (context, input) {
  const res = spawnSync('kubectl', [`--context=${context}`, 'apply', '-f', '-', '-ojson'], { input })

  if (res.error) {
    res.error.output = res.stderr.toString()
    throw res.error
  }

  try {
    return JSON.parse(res.stdout)
  } catch (err) {
    throw new Error(res.stderr.toString())
  }
}

function del (context, namespace, type, name) {
  const res = spawnSync('kubectl', [`--context=${context}`, `--namespace=${namespace}`, 'delete', type, name])

  if (res.error) {
    res.error.output = res.stderr.toString()
    throw res.error
  }

  try {
    return res.stdout.toString()
  } catch (err) {
    throw new Error(res.stderr.toString())
  }
}

function version (context) {
  const res = spawnSync('kubectl', [`--context=${context}`, 'version', '-ojson'])
  if (res.error) {
    throw res.error
  }

  return JSON.parse(res.stdout)
}

module.exports = {
  apply,
  del,
  version
}
