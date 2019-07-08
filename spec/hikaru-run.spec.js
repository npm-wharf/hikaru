const hikaru = require('../lib')
const { expect, assert } = require('chai')

describe('hikaru run', function () {
  it('handles invalid job names', async function () {
    const options = { version: '0.0', context: 'test', spec: 'spec/test-spec' }
    await hikaru.run({ job: 'nodot', ...options })
      .then(() => {
        /* istanbul ignore next */
        assert.fail('should not succeed')
      })
      .catch((err) => {
        expect(err.message).to.include('job.namespace')
      })
    await hikaru.run({ job: 'one.toomany.dots', ...options })
      .then(() => {
        /* istanbul ignore next */
        assert.fail('should not succeed')
      })
      .catch((err) => {
        expect(err.message).to.include('job.namespace')
      })
  })

  it('handles job that does not exist in the spec', async function () {
    const options = { version: '0.0', context: 'test', spec: 'spec/test-spec' }
    await hikaru.run({ job: 'invalid.jobname', ...options })
      .then(() => {
        /* istanbul ignore next */
        assert.fail('should not succeed')
      })
      .catch((err) => {
        expect(err.message).to.include('does not exist')
      })
  })
})
