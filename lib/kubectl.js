'use strict'

const child_process = require('child_process')

function apply (context, input) {
  const res = child_process.spawnSync('kubectl', [`--context=${context}`, 'apply', '-f', '-', '-ojson'], { input })

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
  const res = child_process.spawnSync('kubectl', [`--context=${context}`, `--namespace=${namespace}`, 'delete', type, name])

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
  // Since this is run on every command, and it's the first time we
  // run kubectl we will use the opportunity to make sure kubectl
  // is installed, and that the context we're using exists
  let res = child_process.spawnSync('kubectl')
  if (res.error) {
    throw new Error('kubectl command not found')
  }
  res = child_process.spawnSync('kubectl', ['config', 'get-contexts', context])
  if (res.status !== 0) {
    throw new Error(`context '${context}' not found`)
  }
  res = child_process.spawnSync('kubectl', [`--context=${context}`, 'version', '-ojson'])
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
