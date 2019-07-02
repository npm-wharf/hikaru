const deploy = require('../bin/cmds/deploy')
const sinon = require('sinon')
const child_process = require('child_process')
const { expect } = require('chai')

describe('deploy command', function () {

  it('handles missing kubectl', function () {

    const spawnStub = sinon.stub(child_process, 'spawnSync')
    spawnStub.withArgs('kubectl').returns({ error: new Error('test error') });
    deploy.handler({})
    expect(spawnStub.called).to.equal(true)
    expect(process.exitCode).to.equal(1)
    spawnStub.restore();
  })

  it('handles missing context', function () {

    const spawnStub = sinon.stub(child_process, 'spawnSync')
    const callA = spawnStub.withArgs('kubectl').returns({})
    const callB = spawnStub.withArgs('kubectl', ['config', 'get-contexts', 'invalid']).returns({ status: 1 })
    deploy.handler({ context: 'invalid'})
    expect(callA.called).to.equal(true)
    expect(callB.called).to.equal(true)
    expect(process.exitCode).to.equal(1)
    spawnStub.restore();
  })

  it('handles error getting version', function () {

    const spawnStub = sinon.stub(child_process, 'spawnSync')
    const callA = spawnStub.withArgs('kubectl').returns({})
    const callB = spawnStub.withArgs('kubectl', ['config', 'get-contexts', 'isvalid']).returns({ status: 0 })
    const callC = spawnStub.withArgs('kubectl', ['--context=isvalid', 'version', '-ojson']).throws(new Error('test error'))
    deploy.handler({ context: 'isvalid'})
    expect(callA.called).to.equal(true)
    expect(callB.called).to.equal(true)
    expect(callC.called).to.equal(true)
    expect(process.exitCode).to.equal(1)
    spawnStub.restore();
  })
})
