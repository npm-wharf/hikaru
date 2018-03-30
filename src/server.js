const mcgonagall = require('@npm-wharf/mcgonagall')
const hikaru = require('./index')
const config = require('./config')()
const fount = require('fount')
const express = require('./express')()
const service = require('./service')
const bole = require('bole')
const log = bole('hikaru')
const chalk = require('chalk')

config.http = {
  apiPrefix: '/api',
  configure: express.configure
}

const levelColors = {
  debug: 'gray',
  info: 'white',
  warn: 'yellow',
  error: 'red'
}

const output = {
  write: function (data) {
    const entry = JSON.parse(data)
    const levelColor = levelColors[entry.level]
    console.log(`${chalk[levelColor](entry.time)} - ${chalk[levelColor](entry.level)} ${entry.message}`)
  }
}

bole.output({
  level: process.env.DEBUG ? 'debug' : 'info',
  stream: output
})

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
