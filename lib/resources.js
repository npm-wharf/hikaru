'use strict'

function namespace (name) {
  return {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {
      name
    }
  }
}

module.exports = {
  namespace
}
