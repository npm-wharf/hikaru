'use strict'

const asyncRetry = require('async-retry')

module.exports = async function retry (asyncFn, wait = 500, retries = 20) {
  return asyncRetry(asyncFn, {
    retries,
    factor: 1.5,
    minTimeout: wait,
    maxTimeout: 5000
  })
}
