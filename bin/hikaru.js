#!/usr/bin/env node
const fount = require('fount')
const hikaru = require('../src/index')
const config = fount.get('config')
const fs = require('fs')
const path = require('path')
const chalk = require('chalk')

const levelColors = {
  debug: 'gray',
  info: 'white',
  warn: 'yellow',
  error: 'red'
}

function readFile (relativePath) {
  const fullPath = path.resolve(relativePath.replace('~', process.env.HOME))
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, 'utf8')
  } else {
    throw new Error(`Can't load file from path '${fullPath}'`)
  }
}

const debugOut = {
  write: function (data) {
    const entry = JSON.parse(data)
    const levelColor = levelColors[entry.level]
    console.log(`${chalk[levelColor](entry.time)} - ${chalk[levelColor](entry.level)} ${entry.message}`)
  }
}

require('yargs') // eslint-disable-line no-unused-expressions
  .usage('$0 <command> [options]')
  .command(require('../src/command/create')(config, hikaru, readFile, debugOut))
  .command(require('../src/command/delete')(config, hikaru, readFile, debugOut))
  .demandCommand(1, 'The command?')
  .help()
  .version()
  .argv
