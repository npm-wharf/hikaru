const _ = require('lodash')
const connection = require('./connection')
const parse = require('./imageParser').parse

function createJob (client, jobSpec) {
  return new Promise((resolve, reject) => {
    const namespace = jobSpec.metadata.namespace || 'default'
    jobSpec.apiVersion = 'extensions/v1beta1'
    jobSpec.spec.autoSelector = true
    const templateMeta = jobSpec.spec.template.metadata
    if (!templateMeta.labels || _.keys(templateMeta).length === 0) {
      templateMeta.labels = {
        'job-name': jobSpec.metadata.name
      }
    }
    client.ext.ns(namespace)
      .job.post({ body: jobSpec }, (err, result) => {
        if (err) {
          console.log('error creating job')
          reject(err)
        } else {
          resolve(result)
        }
      })
  })
}

function deleteJob (client, namespace, jobName) {
  return new Promise((resolve, reject) => {
    client.ext.ns(namespace)
      .job.delete(jobName, (err, result) => {
        if (err) {
          reject(err)
        } else {
          resolve(result)
        }
      })
  })
}

function getImageSpecFromDeployment(deployment, image) {
  const containers = deployment.spec.template.spec.containers
  if (containers.length === 1) {
    return containers[0].image
  } else if (image) {
    const container = _.find(containers, c => c.image.indexOf(image) === 0)
    return container.image
  } else {
    return containers[0].image
  }
}

function getJobStatus (client, namespace, jobName) {
  return new Promise((resolve, reject) => {
    client.ext.ns(namespace)
      .job.get(jobName, (err, result) => {
        if (err) {
          reject(err)
        } else {
          resolve(result.status)
        }
      })
  })
}

function getNamespaces (client) {
  return new Promise((resolve, reject) => {
    client.core.namespaces.get((err, list) => {
      if (err) {
        reject(err)
      } else {
        resolve(_.map(list.items, item => {
          return item.metadata.name
        }))
      }
    })
  })
}

function getServiceDetail (client, namespace, serviceName) {
  return new Promise((resolve, reject) => {
    client.ext.ns(namespace).deployment(serviceName)
      .get((err, result) => {
        if (err) {
          reject(err)
        } else {
          resolve(result)
        }
      })
  })
}

function getServicesByNamespace (client, namespace) {
  return new Promise((resolve, reject) => {
    client.ext.ns(namespace).deployments
      .get((err, list) => {
        if (err) {
          reject(err)
        } else {
          let deployments = _.map(list.items, deployment => {
            return {
              service: deployment.metadata.name,
              image:
            }
          })
          resolve({ namespace, services: deployments })
        }
      })
  })
}

function getServicesByLabels (client, namespace, query) {
  return new Promise((resolve, reject) => {
    client.ext.ns(namespace).deployments.matchLabels(query)
      .get((err, list) => {
        if (err) {
          reject(err)
        } else {
          let deployments = _.map(list.items, deployment => {
            return deployment.metadata.name
          })
          resolve({ namespace, services: deployments })
        }
      })
  })
}

function getServicesByImage (client, dockerImage) {
  const info = parse(dockerImage)
  const query = {
    owner: info.owner,
    repo: info.repo,
    branch: info.branch
  }
  return getNamespaces(client)
    .then(namespaces => {
      const updates = _.map(namespaces, namespace => {
        return getServicesByLabels(client, namespace, query)
      })
      return Promise.all(updates)
        .then(list => {
          return _.filter(list, l => l.services.length)
        })
    })
}

function listJobs (client, namespace) {
  return new Promise((resolve, reject) => {
    client.ext.ns(namespace)
      .job.get((err, result) => {
        if (err) {
          reject(err)
        } else {
          result(result)
        }
      })
  })
}

function updateServiceToImage (client, namespace, name, image) {
  const update = {
    name: name,
    body: {
      spec: {
        template: {
          spec: {
            containers: [
              {
                name: name,
                image: image
              }
            ]
          }
        }
      }
    }
  }
  return new Promise((resolve, reject) => {
    client.ext.ns(namespace).deployments.patch(update, (err, result) => {
      if (err) {
        console.log('upgrade failed', err)
        reject(err)
      } else {
        console.log('upgrade started')
        result(result)
      }
    })
  })
}

function updateNamespace (client, dockerImage, set) {
  const pending = _.map(set.services, service => {
    return updateServiceToImage(client, set.namespace, service, dockerImage)
  })
  return Promise.all(pending).then(() => set)
}

function updateService (client, dockerImage) {
  return getServicesByImage(client, dockerImage)
    .then((sets) => {
      const setPromises = _.map(sets, updateNamespace.bind(null, client, dockerImage))
      return Promise.all(setPromises)
    })
}

module.exports = function (config) {
  const client = {
    core: connection.getCoreClient(config),
    ext: connection.getExtensionClient(config)
  }

  return {
    client: client,
    createJob: createJob.bind(null, client),
    deleteJob: deleteJob.bind(null, client),
    getJobStatus: getJobStatus.bind(null, client),
    getNamespaces: getNamespaces.bind(null, client),
    getServiceDetail: getServiceDetail.bind(null, client),
    getServicesByImage: getServicesByImage.bind(null, client),
    getServicesByLabels: getServicesByLabels.bind(null, client),
    getServicesByNamespace: getServicesByNamespace.bind(null, client),
    listJobs: listJobs.bind(null, client),
    update: updateService.bind(null, client)
  }
}
