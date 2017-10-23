const mcgonagall = require('mcgonagall')
const hikaru = require('./index')
const config = require('./config')()
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
  hikaru,
  mcgonagall
}

fount({
  default: dependencies,
  resources: dependencies
})

fount.inject(service.start)
