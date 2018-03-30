require('../setup')
const fs = require('fs')
const path = require('path')
const CACHE_FILE = path.resolve('./spec/.cache')
describe('Alias Cache', function () {
  let cache
  before(function () {
    fs.writeFileSync(CACHE_FILE, '{ "aliases": {} }', {encoding: 'utf8', mode: 0o600})
    cache = require('../../src/aliasCache')(CACHE_FILE)
  })

  describe('when adding an alias with user name and password', function () {
    before(function () {
      cache.addAlias('one', {
        url: 'http://one',
        user: 'admin',
        password: '@dm1n'
      })
    })

    it('should remove user name and password and store base64 encoded credentials instead', function () {
      const json = fs.readFileSync(CACHE_FILE, 'utf8')
      const obj = JSON.parse(json)
      console.log(obj)
      Object.keys(obj['aliases']['one']).should.eql([
        'url',
        'credentials'
      ])
    })
  })

  describe('when adding an alias without user name and password', function () {
    before(function () {
      cache.addAlias('two', {
        url: 'http://two',
        user: 'admin',
        token: 'blahblahblahblah'
      })
    })

    it('should store options as expected', function () {
      const json = fs.readFileSync(CACHE_FILE, 'utf8')
      const obj = JSON.parse(json)
      console.log(obj)
      Object.keys(obj['aliases']['two']).should.eql([
        'url',
        'user',
        'token'
      ])
    })
  })

  describe('when retrieving an alias with user name and password', function () {
    let alias
    before(function () {
      alias = cache.getAlias('one')
    })

    it('should recover user name and password from credentials property', function () {
      alias.should.eql({
        url: 'http://one',
        user: 'admin',
        password: '@dm1n'
      })
    })
  })

  describe('when retrieving an alias without user name and password', function () {
    let alias
    before(function () {
      alias = cache.getAlias('two')
    })

    it('should recover options as expected', function () {
      alias.should.eql({
        url: 'http://two',
        user: 'admin',
        token: 'blahblahblahblah'
      })
    })
  })
  after(function () {
    fs.unlinkSync(CACHE_FILE)
  })
})
