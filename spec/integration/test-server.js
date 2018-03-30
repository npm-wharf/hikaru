const fount = require('fount')
const express = require('../../src/express')()
const service = require('../../src/service')
const bole = require('bole')
const log = bole('hikaru')

module.exports = function (hikaru, mcgonagall, config) {
  config.http = {
    apiPrefix: '/api',
    configure: express.configure
  }

  const dependencies = {
    fount,
    express,
    config,
    hikaru,
    mcgonagall,
    log
  }

  fount({
    default: dependencies,
    resources: dependencies,
    stack: dependencies
  })

  return fount.inject(service.start)
    .then(s => {
      return {
        fount,
        dependencies,
        service: s
      }
    })
}
