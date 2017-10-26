const _ = require('lodash')

function getContainersFromSpec (resource, image) {
  const containers = resource.spec.template.spec.containers
  if (containers.length === 1) {
    return [ {
      image: containers[ 0 ].image,
      name: containers[ 0 ].name
    } ]
  } else if (image) {
    const container = _.find(containers, c => c.image.indexOf(image) === 0)
    return container ? [ {
      image: container.image,
      name: container.name
    } ] : []
  } else {
    return containers.map(x => {
      return { image: x.image, name: x.name }
    })
  }
}

module.exports = {
  getContainersFromSpec: getContainersFromSpec
}
