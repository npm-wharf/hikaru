require('./setup')

const parser = require('../src/imageParser')

describe('Image Parser', function () {
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

  it('should infer latest when tag is missing', function () {
    return parser.parse('docker-image')
      .should.partiallyEql({
        owner: 'official',
        repo: 'docker-image',
        branch: 'master',
        fullVersion: 'latest',
        version: 'latest',
        imageName: 'docker-image',
        imageOwner: 'official'
      })
  })

  it('should leave out defaults when second arg is false', function () {
    return parser.parse('docker-image', false)
      .should.partiallyEql({
        owner: undefined,
        repo: 'docker-image',
        branch: undefined,
        fullVersion: undefined,
        version: undefined,
        imageName: 'docker-image',
        imageOwner: undefined
      })
  })

  it('should parse latest tag', function () {
    return parser.parse('docker-owner/docker-image:latest')
      .should.partiallyEql({
        owner: 'docker-owner',
        repo: 'docker-image',
        branch: 'master',
        fullVersion: 'latest',
        version: 'latest',
        imageName: 'docker-image',
        imageOwner: 'docker-owner'
      })
  })

  it('should parse major version tag', function () {
    return parser.parse('docker-owner/docker-image:1')
      .should.partiallyEql({
        owner: 'docker-owner',
        repo: 'docker-image',
        branch: 'master',
        fullVersion: '1',
        version: '1',
        imageName: 'docker-image',
        imageOwner: 'docker-owner'
      })
  })

  it('should parse major version tag alternates', function () {
    return parser.parse('docker-owner/docker-image:v1')
      .should.partiallyEql({
        owner: 'docker-owner',
        repo: 'docker-image',
        branch: 'master',
        fullVersion: 'v1',
        version: '1',
        imageName: 'docker-image',
        imageOwner: 'docker-owner'
      })
  })

  it('should parse minor verion tag', function () {
    return parser.parse('docker-owner/docker-image:1.1')
      .should.partiallyEql({
        owner: 'docker-owner',
        repo: 'docker-image',
        branch: 'master',
        fullVersion: '1.1',
        version: '1.1',
        imageName: 'docker-image',
        imageOwner: 'docker-owner'
      })
  })

  it('should parse full semver tag', function () {
    return parser.parse('docker-owner/docker-image:1.1.1')
      .should.partiallyEql({
        owner: 'docker-owner',
        repo: 'docker-image',
        branch: 'master',
        fullVersion: '1.1.1',
        version: '1.1.1',
        imageName: 'docker-image',
        imageOwner: 'docker-owner'
      })
  })

  it('should parse full spec tag', function () {
    return parser.parse('docker-owner/docker-image:owner-name_repo_branch-name_1.2.3_12_a1b2c3d4')
      .should.partiallyEql({
        owner: 'owner-name',
        repo: 'repo',
        branch: 'branch-name',
        fullVersion: '1.2.3',
        version: '1.2.3',
        build: '12',
        commit: 'a1b2c3d4',
        imageName: 'docker-image',
        imageOwner: 'docker-owner'
      })
  })

  it('should parse master spec tag', function () {
    return parser.parse('docker-owner/docker-image:1.2.3_a1b2c3d4')
      .should.partiallyEql({
        owner: 'docker-owner',
        repo: 'docker-image',
        branch: 'master',
        fullVersion: '1.2.3',
        version: '1.2.3',
        commit: 'a1b2c3d4',
        imageName: 'docker-image',
        imageOwner: 'docker-owner'
      })
  })

  it('should parse branch spec tag', function () {
    return parser.parse('docker-owner/docker-image:branch-name_1.2.3_12_a1b2c3d4')
      .should.partiallyEql({
        owner: 'docker-owner',
        repo: 'docker-image',
        branch: 'branch-name',
        fullVersion: '1.2.3',
        version: '1.2.3',
        build: '12',
        commit: 'a1b2c3d4',
        imageName: 'docker-image',
        imageOwner: 'docker-owner'
      })
  })

  it('should attempt to parse tags with additional underscores (no owner or image match)', function () {
    resetLogs()
    const result = parser.parse('docker-owner/docker-image:branch_name_oh_no_1.2.3_12_a1b2c3d4')
      .should.partiallyEql({
        owner: 'docker-owner',
        repo: 'docker-image',
        branch: 'branch_name_oh_no',
        fullVersion: '1.2.3',
        version: '1.2.3',
        build: '12',
        commit: 'a1b2c3d4',
        imageName: 'docker-image',
        imageOwner: 'docker-owner'
      })
    logs.should.eql([
      'The tag \'branch_name_oh_no_1.2.3_12_a1b2c3d4\' contains more underscores than I would like.',
      'I will attempt to parse it anyway but may make the wrong assumptions.',
      'This could lead to missed deployments or invalid deployments.',
      'Use of underscores in your github naming conventions and hikaru is ill advised.',
      'Looks like this might be a branch name with underscores only.',
      'Assigning \'branch_name_oh_no\' to branch, \'docker-owner\' to owner and \'docker-image\' to the repo. /shrug'
    ])
    return result
  })

  it('should attempt to parse tags with additional underscores (image match)', function () {
    resetLogs()
    parser.parse('docker_owner/docker_image_name:docker_image_name_branch_1.2.3_12_a1b2c3d4')
      .should.partiallyEql({
        owner: 'docker_owner',
        repo: 'docker_image_name',
        branch: 'branch',
        fullVersion: '1.2.3',
        version: '1.2.3',
        build: '12',
        commit: 'a1b2c3d4',
        imageName: 'docker_image_name',
        imageOwner: 'docker_owner'
      })
    logs.should.eql([
      'The tag \'docker_image_name_branch_1.2.3_12_a1b2c3d4\' contains more underscores than I would like.',
      'I will attempt to parse it anyway but may make the wrong assumptions.',
      'This could lead to missed deployments or invalid deployments.',
      'Use of underscores in your github naming conventions and hikaru is ill advised.',
      'Looks like there are not enough segments to determine the owner and branch - assigning \'docker_owner\' to owner and \'branch\' to branch. /shrug'
    ])

    resetLogs()
    parser.parse('docker_owner/docker_image:me_docker_image_branch_name_1.2.3_12_a1b2c3d4')
      .should.partiallyEql({
        owner: 'me',
        repo: 'docker_image',
        branch: 'branch_name',
        fullVersion: '1.2.3',
        version: '1.2.3',
        build: '12',
        commit: 'a1b2c3d4',
        imageName: 'docker_image',
        imageOwner: 'docker_owner'
      })
    logs.should.eql([
      'The tag \'me_docker_image_branch_name_1.2.3_12_a1b2c3d4\' contains more underscores than I would like.',
      'I will attempt to parse it anyway but may make the wrong assumptions.',
      'This could lead to missed deployments or invalid deployments.',
      'Use of underscores in your github naming conventions and hikaru is ill advised.',
      'The Docker repo and GitHub owner name appear not to match and there are too many remaining tag segments to reliably determine which belong to the repo vs. the branch.',
      'Assigning \'me\' to the owner and \'branch_name\' to the branch. /shrug'
    ])

    resetLogs()
    parser.parse('docker_owner/docker_image_name:me_docker_image_name_branch_1.2.3_12_a1b2c3d4')
      .should.partiallyEql({
        owner: 'me',
        repo: 'docker_image_name',
        branch: 'branch',
        fullVersion: '1.2.3',
        version: '1.2.3',
        build: '12',
        commit: 'a1b2c3d4',
        imageName: 'docker_image_name',
        imageOwner: 'docker_owner'
      })
    logs.should.eql([
      'The tag \'me_docker_image_name_branch_1.2.3_12_a1b2c3d4\' contains more underscores than I would like.',
      'I will attempt to parse it anyway but may make the wrong assumptions.',
      'This could lead to missed deployments or invalid deployments.',
      'Use of underscores in your github naming conventions and hikaru is ill advised.'
    ])
  })

  it('should attempt to parse tags with additional underscores (owner match)', function () {
    resetLogs()
    parser.parse('docker_owner_name/docker_image:docker_owner_name_branch_1.2.3_12_a1b2c3d4')
      .should.partiallyEql({
        owner: 'docker_owner_name',
        repo: 'docker_image',
        branch: 'branch',
        fullVersion: '1.2.3',
        version: '1.2.3',
        build: '12',
        commit: 'a1b2c3d4',
        imageName: 'docker_image',
        imageOwner: 'docker_owner_name'
      })
    logs.should.eql([
      'The tag \'docker_owner_name_branch_1.2.3_12_a1b2c3d4\' contains more underscores than I would like.',
      'I will attempt to parse it anyway but may make the wrong assumptions.',
      'This could lead to missed deployments or invalid deployments.',
      'Use of underscores in your github naming conventions and hikaru is ill advised.',
      'Looks like there are not enough segments to determine the repo and branch - assigning \'docker_image\' to repo and \'branch\' to branch. /shrug'
    ])

    resetLogs()
    parser.parse('docker_owner/docker_image:docker_owner_image_branch_name_1.2.3_12_a1b2c3d4')
      .should.partiallyEql({
        owner: 'docker_owner',
        repo: 'image',
        branch: 'branch_name',
        fullVersion: '1.2.3',
        version: '1.2.3',
        build: '12',
        commit: 'a1b2c3d4',
        imageName: 'docker_image',
        imageOwner: 'docker_owner'
      })
    logs.should.eql([
      'The tag \'docker_owner_image_branch_name_1.2.3_12_a1b2c3d4\' contains more underscores than I would like.',
      'I will attempt to parse it anyway but may make the wrong assumptions.',
      'This could lead to missed deployments or invalid deployments.',
      'Use of underscores in your github naming conventions and hikaru is ill advised.',
      'The Docker image and GitHub repo name appear not to match and there are too many remaining tag segments to reliably determine which belong to the repo vs. the branch.',
      'Assigning \'image\' to the repo and \'branch_name\' to the branch. /shrug'
    ])

    resetLogs()
    parser.parse('docker_owner_name/docker_image:docker_owner_name_image_branch_1.2.3_12_a1b2c3d4')
      .should.partiallyEql({
        owner: 'docker_owner_name',
        repo: 'image',
        branch: 'branch',
        fullVersion: '1.2.3',
        version: '1.2.3',
        build: '12',
        commit: 'a1b2c3d4',
        imageName: 'docker_image',
        imageOwner: 'docker_owner_name'
      })
    logs.should.eql([
      'The tag \'docker_owner_name_image_branch_1.2.3_12_a1b2c3d4\' contains more underscores than I would like.',
      'I will attempt to parse it anyway but may make the wrong assumptions.',
      'This could lead to missed deployments or invalid deployments.',
      'Use of underscores in your github naming conventions and hikaru is ill advised.'
    ])
  })

  it('should refine noise from version', function () {
    return Promise.all([
      parser.refineVersion('v1')
        .should.partiallyEql({
          full: 'v1',
          refined: '1'
        }),
      parser.refineVersion('v1.1')
        .should.partiallyEql({
          refined: '1.1',
          full: 'v1.1'
        }),
      parser.refineVersion('v1.1.0')
        .should.partiallyEql({
          refined: '1.1.0',
          full: 'v1.1.0'
        }),
      parser.refineVersion('v1-alpha')
        .should.partiallyEql({
          refined: '1-alpha',
          full: 'v1-alpha',
          pre: 'alpha'
        }),
      parser.refineVersion('v1.0-alpha')
        .should.partiallyEql({
          refined: '1.0-alpha',
          full: 'v1.0-alpha',
          pre: 'alpha'
        }),
      parser.refineVersion('v1.0.5-alpha')
        .should.partiallyEql({
          refined: '1.0.5-alpha',
          full: 'v1.0.5-alpha',
          pre: 'alpha'
        }),
      parser.refineVersion('v1.0.5-beta.1')
        .should.partiallyEql({
          refined: '1.0.5-beta.1',
          full: 'v1.0.5-beta.1',
          pre: 'beta.1'
        }),
      parser.refineVersion('v1.1.0-21')
        .should.partiallyEql({
          refined: '1.1.0-21',
          full: 'v1.1.0-21',
          pre: '21'
        }),
      parser.refineVersion('1-alpha')
        .should.partiallyEql({
          refined: '1-alpha',
          full: '1-alpha',
          pre: 'alpha'
        }),
      parser.refineVersion('1.0-alpha1')
        .should.partiallyEql({
          refined: '1.0-alpha1',
          full: '1.0-alpha1',
          pre: 'alpha1'
        }),
      parser.refineVersion('1.0.5-alpha.1')
        .should.partiallyEql({
          refined: '1.0.5-alpha.1',
          full: '1.0.5-alpha.1',
          pre: 'alpha.1'
        }),
      parser.refineVersion('1.0.5-beta.1.10')
        .should.partiallyEql({
          refined: '1.0.5-beta.1.10',
          full: '1.0.5-beta.1.10',
          pre: 'beta.1.10'
        }),
      parser.refineVersion('1.0.5-6')
        .should.partiallyEql({
          refined: '1.0.5-6',
          full: '1.0.5-6',
          pre: '6'
        }),
      parser.refineVersion('1-1')
        .should.partiallyEql({
          refined: '1-1',
          full: '1-1'
        }),
      parser.refineVersion('1.2-0')
        .should.partiallyEql({
          refined: '1.2-0',
          full: '1.2-0',
          pre: '0'
        }),
      parser.refineVersion('1.7.0-50')
        .should.partiallyEql({
          refined: '1.7.0-50',
          full: '1.7.0-50',
          pre: '50'
        })
    ])
  })

  after(function () {
    console.warn = OLD_LOG
  })
})
