const mcgonagall = require('@npm-wharf/mcgonagall')
const hikaru = require('./index')
const config = require('./config')()
const fount = require('fount')
const express = require('./express')()
const service = require('./service')
const bole = require('bole')
const log = bole('hikaru')
const version = require('./version')

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

if (config.username && config.password) {
  version.getVersion(config)
    .then(
      v => {
        config.version = v
        fount({
          default: dependencies,
          resources: dependencies,
          stack: dependencies
        })
        fount.inject(service.start)
      }
    )
} else {
  fount({
    default: dependencies,
    resources: dependencies,
    stack: dependencies
  })
  fount.inject(service.start)
}
