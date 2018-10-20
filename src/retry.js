'use strict'

const asyncRetry = require('async-retry')

// bumping the retries to 65 to prevent failures from waiting
// 65 retries is roughly 306 seconds, or 5 minutes.
// in extreme cases, I have seen containers take this long to start
// mostly due to download times to clusters in APAC zones
module.exports = async function retry (asyncFn, wait = 500, retries = 65) {
  return asyncRetry(asyncFn, {
    retries,
    factor: 1.5,
    minTimeout: wait,
    maxTimeout: 5000
  })
}
