const deploy = require('../bin/cmds/deploy')
const run = require('../bin/cmds/run')
const sinon = require('sinon')
const ChildProcess = require('child_process')
const { expect } = require('chai')

let spawnStub
beforeEach(function () {
  spawnStub = sinon.stub(ChildProcess, 'spawnSync')
  process.exitCode = undefined
})
afterEach(function () {
  spawnStub.restore()
})

describe('cli errors', function () {
  describe('deploy command', function () {
    it('handles missing kubectl', function () {
      spawnStub.withArgs('kubectl').returns({ error: new Error('test error') })
      deploy.handler({})
      expect(spawnStub.called).to.equal(true)
      expect(process.exitCode).to.equal(1)
    })

    it('handles missing context', function () {
      const callA = spawnStub.withArgs('kubectl').returns({})
      const callB = spawnStub.withArgs('kubectl', ['config', 'get-contexts', 'invalid']).returns({ status: 1 })
      deploy.handler({ context: 'invalid' })
      expect(callA.called).to.equal(true)
      expect(callB.called).to.equal(true)
      expect(process.exitCode).to.equal(1)
    })

    it('handles error getting version', function () {
      const callA = spawnStub.withArgs('kubectl').returns({})
      const callB = spawnStub.withArgs('kubectl', ['config', 'get-contexts', 'isvalid']).returns({ status: 0 })
      const callC = spawnStub.withArgs('kubectl', ['--context=isvalid', 'version', '-ojson']).throws(new Error('test error'))
      deploy.handler({ context: 'isvalid' })
      expect(callA.called).to.equal(true)
      expect(callB.called).to.equal(true)
      expect(callC.called).to.equal(true)
      expect(process.exitCode).to.equal(1)
    })

    it('handles error with token file', function () {
      const callA = spawnStub.withArgs('kubectl').returns({})
      const callB = spawnStub.withArgs('kubectl', ['config', 'get-contexts', 'isvalid']).returns({ status: 0 })
      const callC = spawnStub.withArgs('kubectl', ['--context=isvalid', 'version', '-ojson']).returns({ stdout: '{"serverVersion":{"major":"0","minor":"0"}}' })
      deploy.handler({ context: 'isvalid', tokenFile: 'spec/bad.yaml' })
      expect(callA.called).to.equal(true)
      expect(callB.called).to.equal(true)
      expect(callC.called).to.equal(true)
      expect(process.exitCode).to.equal(1)
    })
  })

  describe('run command', function () {
    it('handles missing kubectl', function () {
      spawnStub.withArgs('kubectl').returns({ error: new Error('test error') })
      run.handler({})
      expect(spawnStub.called).to.equal(true)
      expect(process.exitCode).to.equal(1)
    })

    it('handles missing context', function () {
      const callA = spawnStub.withArgs('kubectl').returns({})
      const callB = spawnStub.withArgs('kubectl', ['config', 'get-contexts', 'invalid']).returns({ status: 1 })
      run.handler({ context: 'invalid' })
      expect(callA.called).to.equal(true)
      expect(callB.called).to.equal(true)
      expect(process.exitCode).to.equal(1)
    })

    it('handles error getting version', function () {
      const callA = spawnStub.withArgs('kubectl').returns({})
      const callB = spawnStub.withArgs('kubectl', ['config', 'get-contexts', 'isvalid']).returns({ status: 0 })
      const callC = spawnStub.withArgs('kubectl', ['--context=isvalid', 'version', '-ojson']).throws(new Error('test error'))
      run.handler({ context: 'isvalid' })
      expect(callA.called).to.equal(true)
      expect(callB.called).to.equal(true)
      expect(callC.called).to.equal(true)
      expect(process.exitCode).to.equal(1)
    })

    it('handles error with token file', function () {
      const callA = spawnStub.withArgs('kubectl').returns({})
      const callB = spawnStub.withArgs('kubectl', ['config', 'get-contexts', 'isvalid']).returns({ status: 0 })
      const callC = spawnStub.withArgs('kubectl', ['--context=isvalid', 'version', '-ojson']).returns({ stdout: '{"serverVersion":{"major":"0","minor":"0"}}' })
      run.handler({ context: 'isvalid', tokenFile: 'spec/bad.yaml' })
      expect(callA.called).to.equal(true)
      expect(callB.called).to.equal(true)
      expect(callC.called).to.equal(true)
      expect(process.exitCode).to.equal(1)
    })
  })
})

