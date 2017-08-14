const _ = require('lodash')
const semver = require('semver')
const parse = require('../src/imageParser').parse

function compare (installed, built, options) {
  const installedMeta = parse(installed)
  const builtMeta = parse(built)

  if (installedMeta.image.owner !== builtMeta.image.owner) {
    return 'mismatched image owners'
  }
  if (installedMeta.image.name !== builtMeta.image.name) {
    return 'mismatched image names'
  }
  if (installedMeta.branch !== builtMeta.branch && options && options.branch) {
    return 'mismatched branches'
  }
  if (installedMeta.owner !== builtMeta.owner && options && options.owner) {
    return 'mismatched owners'
  }
  if (installedMeta.repo !== builtMeta.repo && options && options.repo) {
    return 'mismatched repos'
  }
  if (installedMeta.commit && installedMeta.commit === builtMeta.commit) {
    return 'equal'
  }
  if (builtMeta.version === 'latest' || installedMeta.version === 'latest') {
    return 'upgrade'
  }
  const builtVersion = _.padEnd(builtMeta.version, 5, '.0')
  const installedVersion = _.padEnd(installedMeta.version, 5, '.0')
  const builtBuild = builtMeta.build ? parseInt(builtMeta.build, 10) : 0
  const installedBuild = installedMeta.build ? parseInt(installedMeta.build, 10) : 0
  if (semver.gte(builtVersion, installedVersion)) {
    return builtBuild >= installedBuild ? 'upgrade' : 'obsolete'
  } else {
    return 'obsolete'
  }
  return 'equal'
}

module.exports = {
  compare: compare
}
