require('./setup')

const compare = require('../src/imageComparer').compare

describe('Image Comparer', function () {
  let OLD_LOG
  let logs = []
  let resetLogs

  before(function () {
    resetLogs = () => {
      logs = []
    }
    OLD_LOG = console.warn
    console.warn = (x) => logs.push(x)
  })

  it('should detect equality between branch spec tags', function () {
    compare(
      'docker-owner/docker-image:branch_1.2.3_12_a1b2c3d4',
      'docker-owner/docker-image:branch_1.2.3_12_a1b2c3d4'
    ).should.equal('equal')
  })

  it('should detect equality between branch spec tags', function () {
    compare(
      'docker-owner/docker-image:owner-name_repo-name_branch-name_1.2.3_12_a1b2c3d4',
      'docker-owner/docker-image:owner-name_repo-name_branch-name_1.2.3_12_a1b2c3d4'
    ).should.equal('equal')
  })

  it('should detect mismatched owners', function () {
    compare(
      'docker-owner/docker-image:latest',
      'different-owner/docker-image:latest'
    ).should.equal('mismatched image owners')
  })

  it('should detect mismatched images', function () {
    compare(
      'docker-owner/docker-image:1',
      'docker-owner/other-image:1'
    ).should.equal('mismatched image names')
  })

  it('should detect mismatched branches', function () {
    compare(
      'docker-owner/docker-image:branch_1.2.3_12_a1b2c3d4',
      'docker-owner/docker-image:different-branch_1.2.3_12_a1b2c3d4',
      {
        branch: true
      }
    ).should.equal('mismatched branches')
  })

  it('should detect mismatched owners', function () {
    compare(
      'docker-owner/docker-image:owner-name_repo-name_branch-name_1.2.3_12_a1b2c3d4',
      'docker-owner/docker-image:other-owner-name_repo-name_branch-name_1.2.3_12_a1b2c3d4',
      {
        owner: true
      }
    ).should.equal('mismatched owners')
  })

  it('should detect mismatched repos', function () {
    compare(
      'docker-owner/docker-image:owner-name_repo-name_branch-name_1.2.3_12_a1b2c3d4',
      'docker-owner/docker-image:owner-name_fork-repo-name_branch-name_1.2.3_12_a1b2c3d4',
      {
        repo: true
      }
    ).should.equal('mismatched repos')
  })

  it('should detect obsolete major versions', function () {
    compare(
      'docker-owner/docker-image:2',
      'docker-owner/docker-image:1'
    ).should.equal('obsolete')
  })

  it('should detect obsolete major/minor versions', function () {
    compare(
      'docker-owner/docker-image:1.2',
      'docker-owner/docker-image:1.1'
    ).should.equal('obsolete')
  })

  it('should detect obsolete semantic versions', function () {
    compare(
      'docker-owner/docker-image:1.2.3',
      'docker-owner/docker-image:1.2.2'
    ).should.equal('obsolete')
  })

  it('should detect obsolete branch specification', function () {
    compare(
      'docker-owner/docker-image:branch_1.2.3_12_a1b2c3d4',
      'docker-owner/docker-image:branch_1.2.3_11_a1b2c3c4'
    ).should.equal('obsolete')
  })

  it('should detect obsolete full specification', function () {
    compare(
      'docker-owner/docker-image:owner-name_repo-name_branch-name_1.2.3_12_a1b2c3d4',
      'docker-owner/docker-image:owner-name_repo-name_branch-name_1.2.3_8_a1b2c3d1'
    ).should.equal('obsolete')
  })

  it('should detect upgrade on latest', function () {
    compare(
      'docker-owner/docker-image:latest',
      'docker-owner/docker-image:latest'
    ).should.equal('upgrade')
  })

  it('should detect upgrade on major version match', function () {
    compare(
      'docker-owner/docker-image:1',
      'docker-owner/docker-image:1'
    ).should.equal('upgrade')
  })

  it('should detect upgrade on major-minor version match', function () {
    compare(
      'docker-owner/docker-image:1.2',
      'docker-owner/docker-image:1.2'
    ).should.equal('upgrade')
  })

  it('should detect upgrade on semantic version match', function () {
    compare(
      'docker-owner/docker-image:1.2.3',
      'docker-owner/docker-image:1.2.3'
    ).should.equal('upgrade')
  })

  it('should detect upgrade on latest', function () {
    compare(
      'docker-owner/docker-image:1',
      'docker-owner/docker-image:latest'
    ).should.equal('upgrade')
  })

  it('should detect upgrade on major version', function () {
    compare(
      'docker-owner/docker-image:1',
      'docker-owner/docker-image:2'
    ).should.equal('upgrade')
  })

  it('should detect upgrade on major-minor version', function () {
    compare(
      'docker-owner/docker-image:1.1',
      'docker-owner/docker-image:1.2'
    ).should.equal('upgrade')
  })

  it('should detect upgrade on semantic version', function () {
    compare(
      'docker-owner/docker-image:1.2.2',
      'docker-owner/docker-image:1.2.3'
    ).should.equal('upgrade')
  })

  it('should detect upgrade on branch specification', function () {
    compare(
      'docker-owner/docker-image:branch_1.2.3_11_a1b2c3d0',
      'docker-owner/docker-image:branch_1.2.3_12_a1b2c3d4'
    ).should.equal('upgrade')
  })

  it('should detect upgrade on full specification', function () {
    compare(
      'docker-owner/docker-image:owner-name_repo-name_branch-name_1.2.3_8_a1b2c3d4',
      'docker-owner/docker-image:owner_repo_branch_1.2.3_12_a1b2c3d8'
    ).should.equal('upgrade')
  })

  after(function () {
    console.warn = OLD_LOG
  })
})
