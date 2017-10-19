const semver = require('semver')
const parse = require('../src/imageParser').parse
const ZEROS = [0, 0, 0]

function compare (installed, built, options) {
  const installedMeta = parse(installed)
  const builtMeta = parse(built)

  if (installedMeta.imageOwner !== builtMeta.imageOwner) {
    return 'mismatched image owners'
  }
  if (installedMeta.imageName !== builtMeta.imageName) {
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
  try {
    const builtVersion = getComparableSemver(builtMeta.version)
    const installedVersion = getComparableSemver(installedMeta.version)
    const versionParts = builtMeta.version.split('-')[0].split('.')
    const builtBuild = builtMeta.build ? parseInt(builtMeta.build, 10) : 0
    const installedBuild = installedMeta.build ? parseInt(installedMeta.build, 10) : 0
    if (builtBuild === installedBuild) {
      if (semver.gt(builtVersion, installedVersion)) {
        return 'upgrade'
      } else if (semver.eq(builtVersion, installedVersion)) {
        return versionParts.length === 3 ? 'equal' : 'upgrade'
      } else {
        return 'obsolete'
      }
    } else {
      if (semver.eq(builtVersion, installedVersion)) {
        return builtBuild > installedBuild ? 'upgrade' : 'obsolete'
      } else if (semver.gt(builtVersion, installedVersion)) {
        return 'upgrade'
      } else {
        return 'obsolete'
      }
    }
  } catch (e) {
    return e.message.replace('Invalid Version:', 'invalid version -')
  }
}

function getComparableSemver (version) {
  const [v, r] = version.split('-')
  const parts = v.split('.')
  if (/[a-zA-Z]+/.test(parts[0])) {
    return version
  }
  const padded = parts.concat(
    ZEROS.slice(0, ZEROS.length - parts.length)
  ).join('.')
  return r ? [ padded, r ].join('-') : padded
}

module.exports = {
  compare: compare
}
