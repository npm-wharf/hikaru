require('../setup')

const server = require('./test-server')
const keys = require('../../src/keys')()
const log = require('bole')('test')
const request = require('request')

const serverPublicKey = keys.read(log, './spec/integration/server/pubkey.pem')
const clientPrivateKey = keys.read(log, './spec/integration/client/privkey.pem')

const hikaru = {}
const mcgonagall = {}

describe('Auth Integration Test', function () {
  describe('with certs and specified token', function () {
    let deftly
    let config
    before(function () {
      config = {
        publicKey: './spec/integration/client/pubkey.pem',
        localKey: './spec/integration/server/privkey.pem',
        apiToken: 'test-token',
        transports: [ 'deftly-express' ],
        resources: [ './src/resources/*.js' ],
        plugins: [ './src/plugins/*.js' ],
        middleware: [ './src/middleware/*.js' ],
        logging: {
          level: 'info'
        }
      }
      return server(hikaru, mcgonagall, config)
        .then(instance => {
          deftly = instance
        })
    })

    it('should get 200 with correct token', function (done) {
      let { token, signature } = keys.encrypt(
        serverPublicKey,
        clientPrivateKey,
        'test-token'
      )
      request({
        url: 'http://localhost:8800/api/_status/ping',
        headers: {
          authorization: token.toString('base64'),
          signature: signature.toString('base64')
        }
      }, (e, result, reply) => {
        reply.should.eql('Ok')
        done()
      })
    })

    it('should get 401 with bad token', function (done) {
      let { token, signature } = keys.encrypt(
        serverPublicKey,
        clientPrivateKey,
        'test-tok3nz'
      )
      request({
        url: 'http://localhost:8800/api/_status/ping',
        headers: {
          authorization: token.toString('base64'),
          signature: signature.toString('base64')
        }
      }, (err, result, reply) => {
        if (err) {
          console.log(err)
        }
        reply.should.eql('Authorization Required')
        done()
      })
    })

    it('should get 401 with missing signature', function (done) {
      let { token } = keys.encrypt(
        serverPublicKey,
        clientPrivateKey,
        'test-token'
      )
      request({
        url: 'http://localhost:8800/api/_status/ping',
        headers: {
          authorization: token.toString('base64')
        }
      }, (err, result, reply) => {
        if (err) {
          console.log(err)
        }
        reply.should.eql('Authorization Required')
        done()
      })
    })

    it('should get 401 with missing token', function (done) {
      let { signature } = keys.encrypt(
        serverPublicKey,
        clientPrivateKey,
        'test-token'
      )
      request({
        url: 'http://localhost:8800/api/_status/ping',
        headers: {
          signature: signature.toString('base64')
        }
      }, (err, result, reply) => {
        if (err) {
          console.log(err)
        }
        reply.should.eql('Authorization Required')
        done()
      })
    })

    it('should get 401 with bad signature', function (done) {
      let { token } = keys.encrypt(
        serverPublicKey,
        clientPrivateKey,
        'test-token'
      )
      request({
        url: 'http://localhost:8800/api/_status/ping',
        headers: {
          authorization: token.toString('base64'),
          signature: 'lol'
        }
      }, (err, result, reply) => {
        if (err) {
          console.log(err)
        }
        reply.should.eql('Authorization Required')
        done()
      })
    })

    after(function () {
      return deftly.service.stop()
    })
  })

  describe('with certs and no token', function () {
    let deftly
    let config
    before(function () {
      config = {
        publicKey: './spec/integration/client/pubkey.pem',
        localKey: './spec/integration/server/privkey.pem',
        transports: [ 'deftly-express' ],
        resources: [ './src/resources/*.js' ],
        plugins: [ './src/plugins/*.js' ],
        middleware: [ './src/middleware/*.js' ],
        logging: {
          level: 'info'
        }
      }
      return server(hikaru, mcgonagall, config)
        .then(instance => {
          deftly = instance
        })
    })

    it('should get 401 with generated token and signature then 200 with returned token', function (done) {
      request({
        url: 'http://localhost:8800/api/_status/ping'
      }, (e, result, reply) => {
        reply.should.eql('Authorization Required')
        let { token, signature } = result.headers
        let tokenBuffer = Buffer.from(token, 'base64')
        let signatureBuffer = Buffer.from(signature, 'base64')
        let decryptedToken = keys.decrypt(serverPublicKey, clientPrivateKey, tokenBuffer, signatureBuffer)
        let creds = keys.encrypt(serverPublicKey, clientPrivateKey, decryptedToken)
        request({
          url: 'http://localhost:8800/api/_status/ping',
          headers: {
            authorization: creds.token.toString('base64'),
            signature: creds.signature.toString('base64')
          }
        }, (e, result, reply) => {
          reply.should.eql('Ok')
          done()
        })
      })
    })

    it('should get 401 with generated token and signature then 401 if returning token and signature back', function (done) {
      request({
        url: 'http://localhost:8800/api/_status/ping'
      }, (e, result, reply) => {
        reply.should.eql('Authorization Required')
        let { token, signature } = result.headers
        request({
          url: 'http://localhost:8800/api/_status/ping',
          headers: {
            authorization: token,
            signature: signature
          }
        }, (e, result, reply) => {
          reply.should.eql('Authorization Required')
          done()
        })
      })
    })

    after(function () {
      return deftly.service.stop()
    })
  })
})
