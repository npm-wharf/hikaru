const mcgonagall = require('@npm-wharf/mcgonagall')
const hikaru = require('./index')
const config = require('./config')()
const fount = require('fount')
const express = require('./express')()
const service = require('./service')
const bole = require('bole')
const log = bole('hikaru')

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

fount.inject(service.start)
