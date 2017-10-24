const _ = require('lodash')
const fs = require('fs')
const path = require('path')

function canPatch (diff) {
  const containers = (((diff.spec || {})
                      .template || {})
                      .spec || {})
                      .containers
  if (containers && _.some(containers, c => {
    return hasCommandChange(c) ||
      hasEnvironmentChanges(c)
  })) {
    return false
  }
  return true
}

function complexDiff (a, b, k) {
  if (Array.isArray(b)) {
    if (b.length > 1) {
      return b.reduce((acc, i) => {
        if (!_.some(a, j => _.isEqual(i, j))) {
          acc.push(i)
        }
        return acc
      }, [])
    } else if (!_.isEqual(a, b)) {
      if (!_.isObject(b[0])) {
        return b
      } else {
        if (isNested(b[0])) {
          return _.filter(_.map(b, (x, i) => {
            if (a.length - 1 >= i) {
              return complexDiff(a[i], b[i])
            } else {
              return x
            }
          }), x => !_.isEmpty(x))
        } else {
          return b
        }
      }
    }
  } else if (_.isObject(b)) {
    let diffs = {}
    for (let c in b) {
      let nested = {}
      if (a[c] == null) {
        nested[c] = b[c]
      } else if (_.isArray(b[c])) {
        if (b[c][0].name || b[c][0].key) {
          nested[c] = complexDiff(a[c], b[c], c)
        } else if (!_.isEqual(a[c], b[c])) {
          nested[c] = b[c]
        }
      } else {
        nested[c] = complexDiff(a[c], b[c], c)
      }
      if ((_.isObject(nested[c]) && Object.keys(nested[c]).length) || (!_.isObject(nested[c]) && nested[c])) {
        diffs = Object.assign({}, diffs, nested)
      }
    }
    return diffs
  } else {
    const equal = a == b // eslint-disable-line eqeqeq
    if (!equal) {
      return b
    }
  }
}

function hasCommandChange (container) {
  return (container.command && container.command.length) ||
    (container.args && container.args.length)
}

function hasEnvironmentChanges (container) {
  return container.env && container.env.length
}

function isBackoffOnly (diff, job) {
  const backoff = (((job.spec || {})
                    .template || {})
                    .spec || {})
                    .backoffLimit
  const template = {
    spec: {
      template: {
        spec: {
          backoffLimit: backoff
        }
      }
    }
  }
  return _.isEqual(diff, template)
}

function saveDiff (a, b, diff) {
  const relative = path.join(process.cwd(), 'diff')
  const namespace = a.metadata.namespace
  const name = a.metadata.name
  const aPath = path.join(relative, `${namespace}-${name}-orignal.json`)
  const bPath = path.join(relative, `${namespace}-${name}-source.json`)
  const diffPath = path.join(relative, `${namespace}-${name}-diff.json`)
  if (!fs.existsSync(relative)) {
    fs.mkdirSync(relative)
  }
  fs.writeFileSync(aPath, JSON.stringify(a, null, 2), 'utf8')
  fs.writeFileSync(bPath, JSON.stringify(b, null, 2), 'utf8')
  fs.writeFileSync(diffPath, JSON.stringify(diff, null, 2), 'utf8')
}

function simpleDiff (a, b, k) {
  if (Array.isArray(b)) {
    if (!_.isEqual(a, b)) {
      if (!_.isObject(b[0])) {
        return b
      } else {
        return _.filter(_.map(b, (x, i) => {
          if (a.length - 1 >= i) {
            return simpleDiff(a[i], b[i])
          } else {
            return x
          }
        }), x => !_.isEmpty(x))
      }
    }
  } else if (_.isObject(b)) {
    let diffs = {}
    for (let c in b) {
      let nested = {}
      if (a[c] == null) {
        nested[c] = b[c]
      } else {
        nested[c] = simpleDiff(a[c], b[c], c)
      }
      if ((_.isObject(nested[c]) && Object.keys(nested[c]).length) || (!_.isObject(nested[c]) && nested[c])) {
        diffs = Object.assign({}, diffs, nested)
      }
    }
    return diffs
  } else {
    const equal = a == b // eslint-disable-line eqeqeq
    if (!equal) {
      return b
    }
  }
}

function isNested (object) {
  return _.some(
    _.values(object),
    x => _.isArray(x) || _.isObject(x)
  )
}

module.exports = {
  canPatch: canPatch,
  complex: complexDiff,
  isBackoffOnly: isBackoffOnly,
  save: saveDiff,
  simple: simpleDiff
}
