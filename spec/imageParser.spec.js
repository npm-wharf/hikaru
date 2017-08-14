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

  it('should parse latest tag', function () {
    parser.parse('docker-owner/docker-image:latest')
      .should.eql({
        owner: 'docker-owner',
        repo: 'docker-image',
        branch: 'master',
        version: 'latest',
        image: {
          name: 'docker-image',
          owner: 'docker-owner'
        },
        build: undefined,
        commit: undefined
      })
  })

  it('should parse major version tag', function () {
    parser.parse('docker-owner/docker-image:1')
      .should.eql({
        owner: 'docker-owner',
        repo: 'docker-image',
        branch: 'master',
        version: '1',
        image: {
          name: 'docker-image',
          owner: 'docker-owner'
        },
        build: undefined,
        commit: undefined
      })
  })

  it('should parse minor verion tag', function () {
    parser.parse('docker-owner/docker-image:1.1')
      .should.eql({
        owner: 'docker-owner',
        repo: 'docker-image',
        branch: 'master',
        version: '1.1',
        image: {
          name: 'docker-image',
          owner: 'docker-owner'
        },
        build: undefined,
        commit: undefined
      })
  })

  it('should parse full semver tag', function () {
    parser.parse('docker-owner/docker-image:1.1.1')
      .should.eql({
        owner: 'docker-owner',
        repo: 'docker-image',
        branch: 'master',
        version: '1.1.1',
        image: {
          name: 'docker-image',
          owner: 'docker-owner'
        },
        build: undefined,
        commit: undefined
      })
  })

  it('should parse full spec tag', function () {
    parser.parse('docker-owner/docker-image:owner-name_repo_branch-name_1.2.3_12_a1b2c3d4')
      .should.eql({
        owner: 'owner-name',
        repo: 'repo',
        branch: 'branch-name',
        version: '1.2.3',
        build: '12',
        commit: 'a1b2c3d4',
        image: {
          name: 'docker-image',
          owner: 'docker-owner'
        }
      })
  })

  it('should parse master spec tag', function () {
    parser.parse('docker-owner/docker-image:1.2.3_a1b2c3d4')
      .should.eql({
        owner: 'docker-owner',
        repo: 'docker-image',
        branch: 'master',
        version: '1.2.3',
        build: undefined,
        commit: 'a1b2c3d4',
        image: {
          name: 'docker-image',
          owner: 'docker-owner'
        }
      })
  })

  it('should parse branch spec tag', function () {
    parser.parse('docker-owner/docker-image:branch-name_1.2.3_12_a1b2c3d4')
      .should.eql({
        owner: 'docker-owner',
        repo: 'docker-image',
        branch: 'branch-name',
        version: '1.2.3',
        build: '12',
        commit: 'a1b2c3d4',
        image: {
          name: 'docker-image',
          owner: 'docker-owner'
        }
      })
  })

  it('should attempt to parse tags with additional underscores (no owner or image match)', function () {
    resetLogs()
    parser.parse('docker-owner/docker-image:branch_name_oh_no_1.2.3_12_a1b2c3d4')
      .should.eql({
        owner: 'docker-owner',
        repo: 'docker-image',
        branch: 'branch_name_oh_no',
        version: '1.2.3',
        build: '12',
        commit: 'a1b2c3d4',
        image: {
          name: 'docker-image',
          owner: 'docker-owner'
        }
      })
    logs.should.eql([
      'The tag \'branch_name_oh_no_1.2.3_12_a1b2c3d4\' contains more underscores than I would like.',
      'I will attempt to parse it anyway but may make the wrong assumptions.',
      'This could lead to missed deployments or invalid deployments.',
      'Use of underscores in your github naming conventions and hikaru is ill advised.',
      'Looks like this might be a branch name with underscores only.',
      'Assigning \'branch_name_oh_no\' to branch, \'docker-owner\' to owner and \'docker-image\' to the repo. /shrug'
    ])
  })

  it('should attempt to parse tags with additional underscores (image match)', function () {
    resetLogs()
    parser.parse('docker_owner/docker_image_name:docker_image_name_branch_1.2.3_12_a1b2c3d4')
      .should.eql({
        owner: 'docker_owner',
        repo: 'docker_image_name',
        branch: 'branch',
        version: '1.2.3',
        build: '12',
        commit: 'a1b2c3d4',
        image: {
          name: 'docker_image_name',
          owner: 'docker_owner'
        }
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
      .should.eql({
        owner: 'me',
        repo: 'docker_image',
        branch: 'branch_name',
        version: '1.2.3',
        build: '12',
        commit: 'a1b2c3d4',
        image: {
          name: 'docker_image',
          owner: 'docker_owner'
        }
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
      .should.eql({
        owner: 'me',
        repo: 'docker_image_name',
        branch: 'branch',
        version: '1.2.3',
        build: '12',
        commit: 'a1b2c3d4',
        image: {
          name: 'docker_image_name',
          owner: 'docker_owner'
        }
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
      .should.eql({
        owner: 'docker_owner_name',
        repo: 'docker_image',
        branch: 'branch',
        version: '1.2.3',
        build: '12',
        commit: 'a1b2c3d4',
        image: {
          name: 'docker_image',
          owner: 'docker_owner_name'
        }
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
      .should.eql({
        owner: 'docker_owner',
        repo: 'image',
        branch: 'branch_name',
        version: '1.2.3',
        build: '12',
        commit: 'a1b2c3d4',
        image: {
          name: 'docker_image',
          owner: 'docker_owner'
        }
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
      .should.eql({
        owner: 'docker_owner_name',
        repo: 'image',
        branch: 'branch',
        version: '1.2.3',
        build: '12',
        commit: 'a1b2c3d4',
        image: {
          name: 'docker_image',
          owner: 'docker_owner_name'
        }
      })
    logs.should.eql([
      'The tag \'docker_owner_name_image_branch_1.2.3_12_a1b2c3d4\' contains more underscores than I would like.',
      'I will attempt to parse it anyway but may make the wrong assumptions.',
      'This could lead to missed deployments or invalid deployments.',
      'Use of underscores in your github naming conventions and hikaru is ill advised.'
    ])
  })

  after(function () {
    console.warn = OLD_LOG
  })
})
