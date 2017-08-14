const config = require('./config')()
const k8 = require('./k8s')(config)
const fount = require('fount')
const express = require('./express')()
const service = require('./service')

config.http = {
  apiPrefix: '/api',
  configure: express.configure
}

const dependencies = {
  fount,
  express,
  config,
  k8
}

fount({
  default: dependencies,
  resources: dependencies
})

fount.inject(service.start)
