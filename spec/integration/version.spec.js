require('../setup')
const version = require('../../src/version')

describe('when requesting version from master', function () {
  describe('when master node cannot be reached', function () {
    let scope
    before(function () {
      scope = nock('https://test.io')
      scope.get('/version')
        .delay(3000)
        .reply(204, 'Cheerio')
    })

    it('should fail with error', function () {
      this.timeout(5000)
      return version.getVersion({ url: 'https://test.io' })
        .should.rejectedWith(`Could not connect to 'https://test.io' with error: network timeout at: https://test.io/version`)
    })

    after(function () {
      nock.cleanAll()
    })
  })

  describe('when credentials fail', function () {
    describe('when master node cannot be reached', function () {
      let scope
      before(function () {
        scope = nock('https://test.io')
        scope.get('/version')
          .basicAuth({
            user: 'test',
            pass: 'test'
          })
          .reply(401, 'Unauthorized')
      })

      it('should fail with error', function () {
        return version.getVersion({ url: 'https://test.io', username: 'test', password: 'test' })
          .should.rejectedWith(`Could not connect to 'https://test.io' with 401: Unauthorized`)
      })

      after(function () {
        nock.cleanAll()
      })
    })
  })

  describe('when connection succeeds', function () {
    let scope
    let config
    before(function () {
      config = {
        url: 'https://test.io',
        username: 'test',
        password: 'test'
      }
      scope = nock('https://test.io')
      const replyWith = (major, minor) =>
        scope
          .get('/version')
          .basicAuth({
            user: 'test',
            pass: 'test'
          }).reply(200, { major, minor })
      replyWith('1', '1')
      replyWith('1', '2')
      replyWith('1', 3)
      replyWith('1', '-4-')
      replyWith('1', '5+')
      replyWith('1', '6=-+')
    })

    describe('when reading numeric only versions', function () {
      it('should return valid major.minor versions', async function () {
        const one = await version.getVersion(config)
        const two = await version.getVersion(config)
        const three = await version.getVersion(config)
        one.should.equal('1.1')
        two.should.equal('1.2')
        three.should.equal('1.3')
      })
    })

    describe('when reading versions with noise', function () {
      it('should return valid major.minor versions', async function () {
        const four = await version.getVersion(config)
        const five = await version.getVersion(config)
        const six = await version.getVersion(config)
        four.should.equal('1.4')
        five.should.equal('1.5')
        six.should.equal('1.6')
      })
    })
  })
})
