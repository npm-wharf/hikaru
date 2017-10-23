require('./setup')

const match = require('../src/cluster')().match

describe('Metadata Matching', function () {
  it('should match when options are empty', function () {
    const resource = {
      imageOwner: 'one',
      imageName: 'two',
      owner: 'three',
      repo: 'four',
      branch: 'five',
      version: 'six'
    }
    const image = {
      imageOwner: 'one',
      imageName: 'two',
      owner: 'three',
      repo: 'four',
      branch: 'five',
      version: 'six'
    }
    const options = {}
    match(resource, image, options).should.eql(true)
  })

  it('should only match on default fields when options are empty', function () {
    const resource = {
      imageOwner: 'one',
      imageName: 'two',
      owner: 'three',
      repo: 'four',
      branch: 'five',
      version: 'six',
      commit: 'seven'
    }
    const image = {
      imageOwner: 'one',
      imageName: 'two',
      owner: 'three',
      repo: 'four',
      branch: 'five',
      version: 'any',
      commit: 'any'
    }
    const options = {}
    match(resource, image, options).should.eql(true)
  })

  it('should not match if options are different from image', function () {
    const resource = {
      imageOwner: 'one',
      imageName: 'two',
      owner: 'three',
      repo: 'four',
      branch: 'five',
      version: 'six',
      commit: 'seven'
    }
    const image = {
      imageOwner: 'one',
      imageName: 'two',
      owner: 'three',
      repo: 'four',
      branch: 'five',
      version: 'six',
      commit: 'seven'
    }
    const options1 = {
      owner: 'threeve'
    }
    const options2 = {
      repo: 'fourteen'
    }
    const options3 = {
      branch: 'fivel'
    }
    const options4 = {
      version: 'sixes'
    }
    const options5 = {
      commit: 'seven-eleven'
    }
    match(resource, image, options1).should.eql(false)
    match(resource, image, options2).should.eql(false)
    match(resource, image, options3).should.eql(false)
    match(resource, image, options4).should.eql(false)
    match(resource, image, options5).should.eql(false)
  })

  it('should not match if options are different from image', function () {
    const resource = {
      imageOwner: 'one',
      imageName: 'two',
      owner: 'three',
      repo: 'four',
      branch: 'five',
      version: 'six',
      commit: 'seven'
    }
    const image = {
      imageOwner: 'one',
      imageName: 'two',
      owner: 'three',
      repo: 'four',
      branch: 'five',
      version: 'six',
      commit: 'seven'
    }
    const options1 = {
      owner: 'threeve'
    }
    const options2 = {
      repo: 'fourteen'
    }
    const options3 = {
      branch: 'fivel'
    }
    const options4 = {
      version: 'sixes'
    }
    const options5 = {
      commit: 'seven-eleven'
    }
    match(resource, image, options1).should.eql(false)
    match(resource, image, options2).should.eql(false)
    match(resource, image, options3).should.eql(false)
    match(resource, image, options4).should.eql(false)
    match(resource, image, options5).should.eql(false)
  })

  it('should match if filter ignores unmatched fields', function () {
    const resource = {
      imageOwner: 'one',
      imageName: 'two',
      owner: 'three',
      repo: 'four',
      branch: 'five',
      version: 'six',
      commit: 'seven'
    }
    const image = {
      imageOwner: 'one',
      imageName: 'two',
      owner: 'threeve',
      repo: 'fourty-five',
      branch: 'five-o',
      version: 'sixty',
      commit: 'seventy'
    }
    const options = {
      filter: 'imageOwner, imageName'
    }
    match(resource, image, options).should.eql(true)
  })
})
