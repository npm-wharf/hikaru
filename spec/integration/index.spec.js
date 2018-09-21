const hikaru = require('../../src/')
const {expect} = require('chai')

const thrown = Symbol('thrown')

describe('hikaru API', () => {
  it('should make coverage cry', async () => {
    const itThrew = await hikaru.runJob().catch(() => thrown)
    expect(itThrew).to.equal(thrown)
  })
})
