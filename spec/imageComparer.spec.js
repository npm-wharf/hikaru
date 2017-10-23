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

  it('should detect equality on full semantic version match', function () {
    compare(
      'docker-owner/docker-image:1.2.3',
      'docker-owner/docker-image:1.2.3'
    ).should.equal('equal')
  })

  it('should detect equality between branch spec tags', function () {
    compare(
      'docker-owner/docker-image:branch_1.2.3_12_a1b2c3d4',
      'docker-owner/docker-image:branch_1.2.3_12_a1b2c3d4'
    ).should.equal('equal')
  })

  it('should detect equality between noisy branch spec tags', function () {
    compare(
      'docker-owner/docker-image:branch_v1.2.3-1_12_a1b2c3d4',
      'docker-owner/docker-image:branch_v1.2.3-1_12_a1b2c3d4'
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

  it('should detect obsolete major pre-release versions', function () {
    compare(
      'docker-owner/docker-image:1-beta',
      'docker-owner/docker-image:1-alpha'
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

  it('should detect obsolete semantic pre-release versions', function () {
    compare(
      'docker-owner/docker-image:1.2.2-alpha.2',
      'docker-owner/docker-image:1.2.2-alpha.1'
    ).should.equal('obsolete')
  })

  it('should detect obsolete noisy semantic pre-release versions', function () {
    compare(
      'docker-owner/docker-image:v1.2.2-alpha.2',
      'docker-owner/docker-image:1.2.2-alpha.1'
    ).should.equal('obsolete')
  })

  it('should detect obsolete branch specification', function () {
    compare(
      'docker-owner/docker-image:branch_1.2.3_12_a1b2c3d4',
      'docker-owner/docker-image:branch_1.2.3_11_a1b2c3c4'
    ).should.equal('obsolete')
  })

  it('should detect obsolete branch pre-release specification', function () {
    compare(
      'docker-owner/docker-image:branch_1.2.3-beta_12_a1b2c3d4',
      'docker-owner/docker-image:branch_1.2.3-beta_11_a1b2c3c4'
    ).should.equal('obsolete')
  })

  it('should detect obsolete noisy branch pre-release specification', function () {
    compare(
      'docker-owner/docker-image:branch_1.2.3-0.1.0_12_a1b2c3d4',
      'docker-owner/docker-image:branch_v1.2.3-0.1.0_11_a1b2c3c4'
    ).should.equal('obsolete')
  })

  it('should detect obsolete full specification', function () {
    compare(
      'docker-owner/docker-image:owner-name_repo-name_branch-name_1.2.3_12_a1b2c3d4',
      'docker-owner/docker-image:owner-name_repo-name_branch-name_1.2.3_8_a1b2c3d1'
    ).should.equal('obsolete')
  })

  it('should detect obsolete full pre-release specification', function () {
    compare(
      'docker-owner/docker-image:owner-name_repo-name_branch-name_1.2.3-1_12_a1b2c3d4',
      'docker-owner/docker-image:owner-name_repo-name_branch-name_1.2.3-1_8_a1b2c3d1'
    ).should.equal('obsolete')
  })

  it('should detect obsolete noisy full pre-release specification', function () {
    compare(
      'docker-owner/docker-image:owner-name_repo-name_branch-name_v1.2.3-delta_12_a1b2c3d4',
      'docker-owner/docker-image:owner-name_repo-name_branch-name_v1.2.3-alpha_12_a1b2c3d1'
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

  it('should detect upgrade on major version vs. minor version match', function () {
    compare(
      'docker-owner/docker-image:1',
      'docker-owner/docker-image:1.2'
    ).should.equal('upgrade')
  })

  it('should detect upgrade on major version vs. semantic version match', function () {
    compare(
      'docker-owner/docker-image:1',
      'docker-owner/docker-image:1.2.3'
    ).should.equal('upgrade')
  })

  it('should detect upgrade on major-minor version match', function () {
    compare(
      'docker-owner/docker-image:1.2',
      'docker-owner/docker-image:1.2'
    ).should.equal('upgrade')
  })

  it('should detect upgrade on latest', function () {
    compare(
      'docker-owner/docker-image:1',
      'docker-owner/docker-image:latest'
    ).should.equal('upgrade')
  })

  it('should detect upgrade on major version difference', function () {
    compare(
      'docker-owner/docker-image:1',
      'docker-owner/docker-image:2'
    ).should.equal('upgrade')
  })

  it('should detect upgrade on major pre-release version difference', function () {
    compare(
      'docker-owner/docker-image:1-alpine',
      'docker-owner/docker-image:1-alpine'
    ).should.equal('upgrade')
  })

  it('should detect upgrade on major pre-release version difference', function () {
    compare(
      'docker-owner/docker-image:1-alpine',
      'docker-owner/docker-image:2-alpine'
    ).should.equal('upgrade')
  })

  it('should detect upgrade on major-minor version', function () {
    compare(
      'docker-owner/docker-image:1.1',
      'docker-owner/docker-image:1.2'
    ).should.equal('upgrade')
  })

  it('should detect upgrade on major-minor version', function () {
    compare(
      'docker-owner/docker-image:1.13-1',
      'docker-owner/docker-image:1.13-2'
    ).should.equal('upgrade')
  })

  it('should detect upgrade on official major-minor version', function () {
    compare(
      'docker-image:1.1-alpine',
      'docker-image:1.2-alpine'
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
      'docker-owner/docker-image:owner-name_repo-name_branch-name_1.2.3_12_a1b2c3d8'
    ).should.equal('upgrade')
  })

  it('should detect invalid version', function () {
    compare(
      'docker-owner/docker-image:nonono',
      'docker-owner/docker-image:1.13-2'
    ).should.equal('invalid version - nonono')

    compare(
      'docker-owner/docker-image:1.13-1',
      'docker-owner/docker-image:nonono'
    ).should.equal('invalid version - nonono')
  })

  it('should ignore mismatches when exclusion filter is supplied', function () {
    compare(
      'docker-owner/docker-image:owner-name_repo-name_branch-name_1.2.3_12_a1b2c3d4',
      'docker-owner/docker-image:other-owner-name_repo-name_branch-name_1.2.4_12_a1b2c3d5',
      {
        owner: false
      }
    ).should.equal('upgrade')

    compare(
      'docker-owner/docker-image:branch_1.2.3_12_a1b2c3d4',
      'docker-owner/docker-image:different-branch_1.2.4_12_a1b2c3d4',
      {
        branch: false,
        commit: false
      }
    ).should.equal('upgrade')

    compare(
      'docker-owner/docker-image:latest',
      'different-owner/docker-image:latest',
      {
        imageOwner: false,
        owner: false
      }
    ).should.equal('upgrade')

    compare(
      'docker-owner/docker-image:owner-name_repo-name_branch-name_1.2.3_8_a1b2c3d4',
      'docker-owner/docker-image:branch-name_1.2.3_12_a1b2c3d8',
      {
        owner: false,
        repo: false
      }
    ).should.equal('upgrade')
  })

  after(function () {
    console.warn = OLD_LOG
    resetLogs()
  })
})
