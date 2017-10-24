const _ = require('lodash')
const parse = require('./imageParser').parse
const log = require('bole')('k8s')

const Promise = require('bluebird')
const join = Promise.join

const diffs = require('./specDiff')

function checkCronJob (client, namespace, job, outcome, resolve, wait) {
  let ms = wait || 500
  let next = ms + (ms / 2)
  setTimeout(() => {
    log.debug(`checking cron job status '${namespace}.${job}' for '${outcome}'`)
    client
      .group('batch')
      .ns(namespace)
      .cronjob(job)
      .get()
      .then(
        result => {
          log.debug(`cron job '${namespace}.${job}' status - '${JSON.stringify(result.status, null, 2)}'`)
          if (outcome === 'creation' && result.status === 'Created') {
            resolve(result)
          } else if (outcome === 'deletion' && result.status.phase !== 'Terminating') {
            resolve(result)
          } else {
            checkJob(client, namespace, job, outcome, resolve, next)
          }
        },
        () => {
          if (outcome === 'deletion') {
            log.debug(`cron job '${namespace}.${job}' deleted successfully.`)
            resolve()
          } else {
            log.debug(`cron job '${namespace}.${job}' status check got API error. Checking again in ${next} ms.`)
            checkJob(client, namespace, job, outcome, resolve, next)
          }
        }
      )
  }, ms)
}

function checkDaemonSet (client, namespace, daemonSet, outcome, resolve, wait) {
  let ms = wait || 500
  let next = ms + (ms / 2)
  setTimeout(() => {
    log.debug(`checking daemonSet status '${namespace}.${daemonSet}' for '${outcome}'`)
    client
      .group('extensions')
      .ns(namespace)
      .daemonSet(daemonSet)
      .get()
      .then(
        result => {
          log.debug(`daemonSet '${namespace}.${daemonSet}' status - '${JSON.stringify(result.status, null, 2)}'`)
          if (outcome === 'creation' && result.status.readyReplicas > 0) {
            resolve(result)
          } else if (outcome === 'deletion' && result.status.phase !== 'Terminating') {
            resolve(result)
          } else {
            checkDaemonSet(client, namespace, daemonSet, outcome, resolve, next)
          }
        },
        () => {
          if (outcome === 'deletion') {
            log.debug(`daemonSet '${namespace}.${daemonSet}' deleted successfully.`)
            resolve()
          } else {
            log.debug(`daemonSet '${namespace}.${daemonSet}' status check got API error. Checking again in ${next} ms.`)
            checkDaemonSet(client, namespace, daemonSet, outcome, resolve, next)
          }
        }
      )
  }, ms)
}

function checkDeployment (client, namespace, deployment, outcome, resolve, wait) {
  let ms = wait || 500
  let next = ms + (ms / 2)
  setTimeout(() => {
    log.debug(`checking deployment status '${namespace}.${deployment}' for '${outcome}'`)
    client
      .group('apps')
      .ns(namespace)
      .deployment(deployment)
      .get()
      .then(
        result => {
          log.debug(`deployment '${namespace}.${deployment}' status - '${JSON.stringify(result.status, null, 2)}'`)
          if (outcome === 'creation' && result.status.readyReplicas > 0) {
            resolve(result)
          } else if (outcome === 'updated' && result.status.updatedReplicas > 0 && result.status.readyReplicas > 0) {
            resolve(result)
          } else if (outcome === 'deletion' && result.status.phase !== 'Terminating') {
            resolve(result)
          } else {
            checkDeployment(client, namespace, deployment, outcome, resolve, next)
          }
        },
        () => {
          if (outcome === 'deletion') {
            log.debug(`deployment '${namespace}.${deployment}' deleted successfully.`)
            resolve()
          } else {
            log.debug(`deployment '${namespace}.${deployment}' status check got API error. Checking again in ${next} ms.`)
            checkDeployment(client, namespace, deployment, outcome, resolve, next)
          }
        }
      )
  }, ms)
}

function checkJob (client, namespace, job, outcome, resolve, reject, wait) {
  let ms = wait || 500
  let next = ms + (ms / 2)
  setTimeout(() => {
    log.debug(`checking job status '${namespace}.${job}' for '${outcome}'`)
    client
      .group('batch')
      .ns(namespace)
      .job(job)
      .get()
      .then(
        result => {
          try {
            log.debug(`job '${namespace}.${job}' status - '${JSON.stringify(result.status, null, 2)}'`)
            const status = result.status.conditions && result.status.conditions.length
                              ? result.status.conditions[0] : {}
            if (outcome === 'completion' && status.type === 'Complete' && status.status === 'True') {
              resolve(result)
            } else if (outcome === 'updated' && status.type === 'Complete' && status.status === 'True') {
              resolve(result)
            } else if (outcome === 'completion' && status.type === 'Failed' && status.status === 'True') {
              reject(new Error(`Job '${namespace}.${job}' failed to complete with status: '${JSON.stringify(result.status, null, 2)}'`))
            } else if (outcome === 'updated' && status.type === 'Failed' && status.status === 'True') {
              reject(new Error(`Job '${namespace}.${job}' failed to update with status: '${JSON.stringify(result.status, null, 2)}'`))
            } else {
              checkJob(client, namespace, job, outcome, resolve, reject, next)
            }
          } catch (e) {
            log.error(`error checking result '${JSON.stringify(result, null, 2)}':\n\t${e}`)
          }
        },
        () => {
          if (outcome === 'deletion') {
            log.debug(`job '${namespace}.${job}' deleted successfully.`)
            resolve()
          } else {
            log.debug(`job '${namespace}.${job}' status check got API error. Checking again in ${next} ms.`)
            checkJob(client, namespace, job, outcome, resolve, reject, next)
          }
        }
      )
  }, ms)
}

function checkNamespace (client, namespace, outcome, resolve, wait) {
  let ms = wait || 250
  let next = ms + (ms / 2)
  log.debug(`checking namespace status '${namespace}' for '${outcome}'`)
  setTimeout(() => {
    client.namespace(namespace).get()
      .then(
        result => {
          log.debug(`namespace '${namespace}' status - '${result.status.phase}'`)
          if (outcome === 'creation' && result.status.phase === 'Active') {
            resolve(result)
          } else if (outcome === 'deletion' && result.status.phase !== 'Terminating') {
            resolve(result)
          } else {
            checkNamespace(client, namespace, outcome, resolve, next)
          }
        },
        () => {
          if (outcome === 'deletion') {
            log.debug(`namespace '${namespace}' deleted successfully`)
            resolve()
          } else {
            log.debug(`namespace '${namespace}' status - resulted in API error. Checking again in ${next} ms.`)
            checkNamespace(client, namespace, outcome, resolve, next)
          }
        }
      )
  }, ms)
}

function checkService (client, namespace, service, outcome, resolve, wait) {
  let ms = wait || 500
  let next = ms + (ms / 2)
  log.debug(`checking service status '${namespace}.${service}' for '${outcome}'`)
  setTimeout(() => {
    client
      .ns(namespace)
      .service(service)
      .get()
      .then(
        result => {
          log.debug(`service '${namespace}.${service}' status - '${JSON.stringify(result.status, null, 2)}'`)
          if (outcome === 'creation' && result.status.loadBalancer) {
            resolve(result)
          } else {
            checkService(client, namespace, service, outcome, resolve, next)
          }
        },
        () => {
          if (outcome === 'deletion') {
            log.debug(`service '${namespace}.${service}' deleted successfully.`)
            resolve()
          } else {
            log.debug(`checking service '${namespace}.${service}' status - resulted in API error. Checking again in ${next} ms.`)
            checkService(client, namespace, service, outcome, resolve, next)
          }
        }
      )
  }, ms)
}

function checkStatefulSet (client, namespace, statefulSet, outcome, resolve, wait) {
  let ms = wait || 500
  let next = ms + (ms / 2)
  log.debug(`checking statefulSet status '${namespace}.${statefulSet}' for '${outcome}'`)
  setTimeout(() => {
    client
      .group('apps')
      .ns(namespace)
      .statefulset(statefulSet)
      .get()
      .then(
        result => {
          log.debug(`statefulSet '${namespace}.${statefulSet}' status - '${JSON.stringify(result.status, null, 2)}'`)
          if (outcome === 'creation' && result.status.readyReplicas > 0) {
            resolve(result)
          } else if (outcome === 'updated' && result.status.readyReplicas > 0) {
            resolve(result)
          } else if (outcome === 'deletion' && result.status.phase !== 'Terminating') {
            resolve(result)
          } else {
            checkStatefulSet(client, namespace, statefulSet, outcome, resolve, next)
          }
        },
        () => {
          if (outcome === 'deletion') {
            log.debug(`statefulSet '${namespace}.${statefulSet}' deleted successfully.`)
            resolve()
          } else {
            log.debug(`statefulSet '${namespace}.${statefulSet}' status check got API error. Checking again in ${next} ms.`)
            checkStatefulSet(client, namespace, statefulSet, outcome, resolve, next)
          }
        }
      )
  }, ms)
}

function createAccount (client, accountSpec) {
  const namespace = accountSpec.metadata.namespace || 'default'
  const name = accountSpec.metadata.name
  let createNew = () => {
    return client
      .ns(namespace)
      .serviceaccounts
      .create(accountSpec)
      .then(
        null,
        err => {
          throw new Error(`Service account '${accountSpec.metadata.namespace}.${accountSpec.metadata.name}' failed to create:\n\t${err.message}`)
        }
      )
  }

  return client
    .ns(namespace)
    .serviceaccount(name)
    .get()
    .then(
      loaded => {
        const diff = diffs.simple(loaded, accountSpec)
        if (_.isEmpty(diff)) {
          return true
        } else {
          if (diffs.canPatch(diff)) {
            if (client.saveDiffs) {
              diffs.save(loaded, accountSpec, diff)
            }
            return updateAccount(client, namespace, name, diff)
          } else {
            return replaceAccount(client, namespace, name, diff)
          }
        }
      },
      createNew
    )
}

function createConfiguration (client, configSpec) {
  const namespace = configSpec.metadata.namespace
  const name = configSpec.metadata.name
  let createNew = () => {
    return client
      .ns(namespace)
      .configmaps
      .create(configSpec)
      .then(
        null,
        err => {
          throw new Error(`Configuration map '${namespace}.${name}' failed to create:\n\t${err.message}`)
        }
      )
  }

  return client
    .ns(namespace)
    .configmap(name)
    .get()
    .then(
      loaded => {
        const diff = diffs.simple(loaded, configSpec)
        if (_.isEmpty(diff)) {
          return true
        } else {
          if (client.saveDiffs) {
            diffs.save(loaded, configSpec, diff)
          }
          return updateConfiguration(client, namespace, name, diff)
        }
      },
      createNew
    )
}

function createCronJob (client, jobSpec) {
  const namespace = jobSpec.metadata.namespace || 'default'
  const name = jobSpec.metadata.name
  let create = (resolve, reject) => client
    .group('batch')
    .ns(namespace)
    .cronjobs
    .create(jobSpec)
    .then(
      result => {
        checkCronJob(client, namespace, name, 'completion', resolve, reject)
      },
      err => {
        reject(new Error(`Cron Job '${namespace}.${name}' failed to create:\n\t${err.message}`))
      }
    )
  return new Promise((resolve, reject) => {
    client
      .group('batch')
      .ns(namespace)
      .cronjob(name)
      .get()
      .then(
        loaded => {
          const diff = diffs.simple(loaded, jobSpec)
          if (_.isEmpty(diff)) {
            resolve()
          } else {
            if (diffs.canPatch(diff) || diffs.isBackoffOnly(diff, jobSpec)) {
              if (client.saveDiffs) {
                diffs.save(loaded, jobSpec, diff)
              }
              updateCronJob(client, namespace, name, diff)
                .then(
                  resolve,
                  reject
                )
            } else {
              replaceCronJob(client, namespace, name, jobSpec)
                .then(
                  resolve,
                  reject
                )
            }
          }
        },
        create.bind(null, resolve, reject)
      )
  })
}

function createDaemonSet (client, daemonSet) {
  const namespace = daemonSet.metadata.namespace || 'default'
  const name = daemonSet.metadata.name

  let create = (resolve, reject) => client
    .group('extensions')
    .ns(namespace)
    .daemonsets
    .create(daemonSet)
    .then(
      result => {
        checkDaemonSet(client, namespace, name, 'creation', resolve)
      },
      err => {
        reject(new Error(`DaemonSet '${namespace}.${name}' failed to create:\n\t${err.message}`))
      }
    )

  return new Promise((resolve, reject) => {
    client
      .group('extensions')
      .ns(namespace)
      .daemonset(name)
      .get()
      .then(
        loaded => {
          const diff = diffs.simple(loaded, daemonSet)
          if (_.isEmpty(diff)) {
            resolve()
          } else {
            if (diffs.canPatch(diff)) {
              if (client.saveDiffs) {
                diffs.save(loaded, daemonSet, diff)
              }
              patchDaemonSet(client, namespace, name, diff)
                .then(
                  resolve,
                  reject
                )
            } else {
              replaceDaemonSet(client, namespace, name, daemonSet)
                .then(
                  resolve,
                  reject
                )
            }
          }
        },
        create.bind(null, resolve, reject)
      )
  })
}

function createDeployment (client, deployment) {
  const namespace = deployment.metadata.namespace || 'default'
  const name = deployment.metadata.name
  let create = (resolve, reject) => client
    .group('apps')
    .ns(namespace)
    .deployments
    .create(deployment)
    .then(
      result => {
        checkDeployment(client, namespace, name, 'creation', resolve)
      },
      err => {
        reject(new Error(`Deployment '${namespace}.${name}' failed to create:\n\t${err.message}`))
      }
    )

  return new Promise((resolve, reject) => {
    client
      .group('apps')
      .ns(namespace)
      .deployment(name)
      .get()
      .then(
        loaded => {
          const diff = diffs.simple(loaded, deployment)
          if (_.isEmpty(diff)) {
            resolve()
          } else {
            if (diffs.canPatch(diff)) {
              if (client.saveDiffs) {
                diffs.save(loaded, deployment, diff)
              }
              updateDeployment(client, namespace, name, diff)
                .then(
                  resolve,
                  reject
                )
            } else {
              replaceDeployment(client, namespace, name, deployment)
                .then(
                  resolve,
                  reject
                )
            }
          }
        },
        create.bind(null, resolve, reject)
      )
  })
}

function createJob (client, jobSpec) {
  const namespace = jobSpec.metadata.namespace || 'default'
  const name = jobSpec.metadata.name
  let create = (resolve, reject) => client
    .group('batch')
    .ns(namespace)
    .jobs
    .create(jobSpec)
    .then(
      result => {
        checkJob(client, namespace, name, 'completion', resolve, reject)
      },
      err => {
        reject(new Error(`Job '${namespace}.${name}' failed to create:\n\t${err.message}`))
      }
    )
  return new Promise((resolve, reject) => {
    client
      .group('batch')
      .ns(namespace)
      .job(name)
      .get()
      .then(
        loaded => {
          const diff = diffs.simple(loaded, jobSpec)
          if (_.isEmpty(diff) || diffs.isBackoffOnly(diff, jobSpec)) {
            resolve()
          } else {
            if (diffs.canPatch(diff)) {
              if (client.saveDiffs) {
                diffs.save(loaded, jobSpec, diff)
              }
              updateJob(client, namespace, name, diff)
                .then(
                  resolve,
                  reject
                )
            } else {
              replaceJob(client, namespace, name, jobSpec)
                .then(
                  resolve,
                  reject
                )
            }
          }
        },
        create.bind(null, resolve, reject)
      )
  })
}

function createNamespace (client, namespace) {
  const namespaceSpec = {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {
      name: namespace
    }
  }
  return getNamespace(client, namespace)
    .then(
      result => result,
      () => client
        .namespaces
        .create(namespaceSpec)
        .then(
          null,
          err => {
            throw new Error(`Namespace '${namespace}' failed to create:\n\t${err.message}`)
          }
        )
    )
}

function createRoleBinding (client, roleBinding) {
  const namespace = roleBinding.metadata.namespace || 'default'
  if (roleBinding.kind === 'ClusterRoleBinding') {
    return client
      .group('rbac.authorization.k8s.io/v1beta1')
      .clusterrolebindings
      .create(roleBinding)
      .then(
        null,
        err => {
          throw new Error(`Cluster Role Binding '${roleBinding.metadata.namespace}.${roleBinding.metadata.name}' failed to create:\n\t${err.message}`)
        }
      )
  } else {
    return client
      .group('rbac.authorization.k8s.io/v1beta1')
      .ns(namespace)
      .rolebindings
      .create(roleBinding)
      .then(
        null,
        err => {
          throw new Error(`Role Binding '${roleBinding.metadata.namespace}.${roleBinding.metadata.name}' failed to create:\n\t${err.message}`)
        }
      )
  }
}

function createService (client, service) {
  const namespace = service.metadata.namespace || 'default'
  const name = service.metadata.name
  let create = (resolve, reject) => client
    .ns(namespace)
    .services
    .create(service)
    .then(
      result => {
        checkService(client, namespace, name, 'creation', resolve)
      },
      err => {
        reject(new Error(`Service '${namespace}.${name}' failed to create:\n\t${err.message}`))
      }
    )
  return new Promise((resolve, reject) => {
    client
      .ns(namespace)
      .service(name)
      .get()
      .then(
        loaded => {
          const diff = diffs.simple(loaded, service)
          if (_.isEmpty(diff)) {
            resolve()
          } else {
            if (diffs.canPatch(diff)) {
              if (client.saveDiffs) {
                diffs.save(loaded, service, diff)
              }
              updateService(client, namespace, name, diff)
                .then(
                  resolve,
                  reject
                )
            } else {
              replaceService(client, namespace, name, service)
                .then(
                  resolve,
                  reject
                )
            }
          }
        },
        create.bind(null, resolve, reject)
      )
  })
}

function createStatefulSet (client, statefulSet) {
  const namespace = statefulSet.metadata.namespace || 'default'
  const name = statefulSet.metadata.name
  let create = (resolve, reject) => client
    .group('apps')
    .ns(namespace)
    .statefulsets
    .create(statefulSet)
    .then(
      result => {
        checkStatefulSet(client, namespace, name, 'creation', resolve)
      },
      err => {
        reject(new Error(`StatefulSet '${namespace}.${name}' failed to create:\n\t${err.message}`))
      }
    )
  return new Promise((resolve, reject) => {
    client
      .group('apps')
      .ns(namespace)
      .statefulset(name)
      .get()
      .then(
        loaded => {
          const diff = diffs.simple(loaded, statefulSet)
          if (_.isEmpty(diff)) {
            resolve()
          } else {
            if (diffs.canPatch(diff)) {
              if (client.saveDiffs) {
                diffs.save(loaded, statefulSet, diff)
              }
              updateStatefulSet(client, namespace, name, diff)
                .then(
                  resolve,
                  reject
                )
            } else {
              replaceStatefulSet(client, namespace, name, statefulSet)
                .then(
                  resolve,
                  reject
                )
            }
          }
        },
        create.bind(null, resolve, reject)
      )
  })
}

function deleteAccount (client, namespace, name) {
  return client.ns(namespace).serviceaccount(name).get()
    .then(
      () => {
        return client.ns(namespace).serviceaccount(name).delete()
          .then(
            null,
            err => {
              throw new Error(`Account '${namespace}.${name}' could not be deleted:\n\t${err.message}`)
            }
          )
      },
     () => { return true }
    )
}

function deleteDaemonSet (client, namespace, name) {
  return new Promise((resolve, reject) => {
    client
      .group('extensions')
      .ns(namespace)
      .daemonset(name)
      .then(
        () => {
          client
            .group('extensions')
            .ns(namespace)
            .daemonset(name)
            .delete()
            .then(
              result => {
                checkDaemonSet(client, namespace, name, 'deletion', resolve)
              },
              err => {
                reject(new Error(`DaemonSet '${namespace}.${name}' could not be deleted:\n\t${err.message}`))
              }
            )
        },
        () => {
          resolve()
        }
      )
  })
}

function deleteDeployment (client, namespace, name) {
  return new Promise((resolve, reject) => {
    client
      .group('apps')
      .ns(namespace)
      .deployment(name)
      .get()
      .then(
        () => {
          client
            .group('apps')
            .ns(namespace)
            .deployment(name)
            .delete()
            .then(
              result => {
                checkDeployment(client, namespace, name, 'deletion', resolve)
              },
              err => {
                reject(new Error(`Deployment '${namespace}.${name}' could not be deleted:\n\t${err.message}`))
              }
            )
        },
        () => resolve()
      )
  })
}

function deleteConfiguration (client, namespace, name) {
  return client.ns(namespace).configmap(name).get()
    .then(
      () => {
        return client.ns(namespace).configmap(name).delete()
      },
      () => { return true }
    )
}

function deleteJob (client, namespace, name) {
  return new Promise((resolve, reject) => {
    client
      .group('batch')
      .ns(namespace)
      .job(name)
      .get()
      .then(
        () => {
          client
            .group('batch')
            .ns(namespace)
            .job(name)
            .delete()
            .then(
              result => {
                checkJob(client, namespace, name, 'deletion', resolve)
              },
              err => {
                reject(new Error(`Job '${namespace}.${name}' could not be deleted:\n\t${err.message}`))
              }
            )
        },
        () => { resolve() }
      )
  })
}

function deleteNamespace (client, namespace) {
  return new Promise((resolve, reject) => {
    return getNamespace(client, namespace)
      .then(
        () => {
          client.namespace(namespace).delete()
            .then(
              result =>
                checkNamespace(client, namespace, 'deletion', resolve),
              err => reject(new Error(`Namespace '${namespace}' could not be deleted:\n\t${err.message}`))
            )
        },
        () => { resolve() }
      )
  })
}

function deleteRoleBinding (client, namespace, name) {
  return client
    .group('rbac.authorization.k8s.io/v1beta1')
    .ns(namespace)
    .clusterrolebinding(name)
    .get()
    .then(
      () => {
        return client
          .group('rbac.authorization.k8s.io/v1beta1')
          .ns(namespace)
          .clusterrolebinding(name)
          .delete()
          .then(
            null,
            err => {
              throw new Error(`Role Binding '${namespace}.${name}' could not be deleted:\n\t${err.message}`)
            }
          )
      },
      () => { return true }
    )
}

function deleteService (client, namespace, name) {
  return new Promise((resolve, reject) => {
    client
      .ns(namespace)
      .service(name)
      .get()
      .then(
        () => {
          client
            .ns(namespace)
            .service(name)
            .delete()
            .then(
              result => {
                checkService(client, namespace, name, 'deletion', resolve)
              },
              err => {
                reject(new Error(`Service '${namespace}.${name}' could not be deleted:\n\t${err.message}`))
              }
            )
        },
        () => { resolve() }
      )
  })
}

function deleteStatefulSet (client, namespace, name) {
  return new Promise((resolve, reject) => {
    client
      .group('apps')
      .ns(namespace)
      .statefulset(name)
      .get()
      .then(
        () => {
          client
            .group('apps')
            .ns(namespace)
            .statefulset(name)
            .delete()
            .then(
              result => {
                checkDeployment(client, namespace, name, 'deletion', resolve)
              },
              err => {
                reject(new Error(`StatefulSet '${namespace}.${name}' could not be deleted:\n\t${err.message}`))
              }
            )
        },
        () => { resolve() }
      )
  })
}

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

function getDaemonSetsByNamespace (client, namespace, baseImage) {
  return listDaemonSets(client, namespace)
      .then(
        list => {
          let daemonSets = _.reduce(list.items, (acc, spec) => {
            const containers = getContainersFromSpec(spec, baseImage)
            containers.forEach(container => {
              const metadata = parse(container.image)
              acc.push({
                namespace: namespace,
                type: 'DaemonSet',
                service: spec.metadata.name,
                image: container.image,
                container: container.name,
                metadata: metadata,
                labels: spec.template.metadata
                  ? spec.template.metadata.labels
                  : {}
              })
            })
            return acc
          }, [])
          return { namespace, daemonSets }
        }
      )
}

function getDeploymentsByNamespace (client, namespace, baseImage) {
  return listDeployments(client, namespace)
      .then(
        list => {
          let deployments = _.reduce(list.items, (acc, spec) => {
            const containers = getContainersFromSpec(spec, baseImage)
            containers.forEach(container => {
              const metadata = parse(container.image)
              acc.push({
                namespace: namespace,
                type: 'Deployments',
                service: spec.metadata.name,
                image: container.image,
                container: container.name,
                metadata: metadata,
                labels: spec.template.metadata
                  ? spec.template.metadata.labels
                  : {}
              })
            })
            return acc
          }, [])
          return { namespace, deployments }
        }
      )
}

function getImagePatch (name, image) {
  return {
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

function getNamespace (client, namespace, image) {
  return client.namespace(namespace).get()
}

function getStatefulSetsByNamespace (client, namespace, baseImage) {
  return listStatefulSets(client, namespace)
      .then(
        list => {
          let statefulSets = _.reduce(list.items, (acc, spec) => {
            const containers = getContainersFromSpec(spec, baseImage)
            containers.forEach(container => {
              const metadata = parse(container.image)
              acc.push({
                namespace: namespace,
                type: 'StatefulSet',
                service: spec.metadata.name,
                image: container.image,
                container: container.name,
                metadata: metadata,
                labels: spec.template.metadata
                  ? spec.template.metadata.labels
                  : {}
              })
            })
            return acc
          }, [])
          return { namespace, statefulSets }
        }
      )
}

function listAccounts (client, namespace) {
  return client
    .ns(namespace)
    .serviceaccounts
    .list()
}

function listConfigurations (client, namespace) {
  return client
    .ns(namespace)
    .configmaps
    .list()
}

function listCronJobs (client, namespace) {
  return client
      .group('batch')
      .ns(namespace)
      .cronjobs
      .list()
}

function listDaemonSets (client, namespace) {
  return client
      .group('extensions')
      .ns(namespace)
      .daemonsets
      .list()
}

function listDeployments (client, namespace) {
  return client
      .group('apps')
      .ns(namespace)
      .deployments
      .list()
}

function listJobs (client, namespace) {
  return client
      .group('batch')
      .ns(namespace)
      .jobs
      .list()
}

function listNamespaces (client) {
  return client
    .namespaces
    .list()
    .then(
      list => list.items.map(item => item.metadata.name)
    )
}

function listRoleBindings (client, namespace) {
  let getClusterBindings = () => {
    return client
      .group('rbac.authorization.k8s.io/v1beta1')
      .clusterrolebindings
      .list()
  }

  let getBindings = () => {
    return client
      .group('rbac.authorization.k8s.io/v1beta1')
      .rolebindings
      .list()
  }

  return join(getClusterBindings(), getBindings(), (cluster, plain) => {
    return cluster.concat(plain)
  })
}

function listServices (client, namespace) {
  return client
    .ns(namespace)
    .services
    .list()
}

function listStatefulSets (client, namespace) {
  return client
      .group('apps')
      .ns(namespace)
      .statefulsets
      .list()
}

function patchDaemonSet (client, namespace, name, diff) {
  return new Promise((resolve, reject) => {
    client
      .group('extensions')
      .ns(namespace)
      .daemonset(name)
      .patch(diff)
      .then(
        result => {
          checkDaemonSet(client, namespace, name, 'update', resolve)
        },
        err => {
          reject(new Error(`DaemonSet '${namespace}.${name}' failed to patch:\n\t${err.message}`))
        }
      )
  })
}

function replaceAccount (client, namespace, name, spec) {
  return client
    .ns(namespace)
    .serviceaccount(name)
    .update(spec)
    .then(
      null,
      err => {
        throw new Error(`Account '${namespace}.${name}' failed to replace:\n\t${err.message}`)
      }
    )
}

function replaceConfiguration (client, configSpec) {
  const namespace = configSpec.metadata.namespace
  const name = configSpec.metadata.name
  return client.ns(namespace).configmap(name).replace(configSpec)
    .then(
      null,
      err => {
        throw new Error(`Configuration map '${namespace}.${name}' failed to replace:\n\t${err.message}`)
      }
    )
}

function replaceDaemonSet (client, namespace, name, spec) {
  return new Promise((resolve, reject) => {
    client
      .group('extensions')
      .ns(namespace)
      .daemonset(name)
      .update(spec)
      .then(
        result => {
          checkDaemonSet(client, namespace, name, 'update', resolve)
        },
        err => {
          reject(new Error(`DaemonSet '${namespace}.${name}' failed to replace:\n\t${err.message}`))
        }
      )
  })
}

function replaceDeployment (client, namespace, name, spec) {
  return new Promise((resolve, reject) => {
    client
      .group('apps')
      .ns(namespace)
      .deployment(name)
      .update(spec)
      .then(
        result => {
          checkDeployment(client, namespace, name, 'updated', resolve)
        },
        err => {
          reject(new Error(`Deployment '${namespace}.${name}' failed to replace:\n\t${err.message}`))
        }
      )
  })
}

function replaceCronJob (client, namespace, name, spec) {
  return new Promise((resolve, reject) => {
    client
      .group('batch')
      .ns(namespace)
      .cronjob(name)
      .update(spec)
      .then(
        result => {
          checkCronJob(client, namespace, name, 'update', resolve)
        },
        err => {
          reject(new Error(`CronJob '${namespace}.${name}' failed to replace:\n\t${err.message}`))
        }
      )
  })
}

function replaceJob (client, namespace, name, spec) {
  return new Promise((resolve, reject) => {
    client
      .group('batch')
      .ns(namespace)
      .job(name)
      .update(spec)
      .then(
        result => {
          checkJob(client, namespace, name, 'updated', resolve)
        },
        err => {
          reject(new Error(`Job '${namespace}.${name}' failed to replace:\n\t${err.message}`))
        }
      )
  })
}

function replaceService (client, namespace, name, spec) {
  return new Promise((resolve, reject) => {
    client
      .ns(namespace)
      .service(name)
      .update(spec)
      .then(
        result => {
          checkService(client, namespace, name, 'update', resolve)
        },
        err => {
          reject(new Error(`Service '${namespace}.${name}' failed to replace:\n\t${err.message}`))
        }
      )
  })
}

function replaceStatefulSet (client, namespace, name, spec) {
  return new Promise((resolve, reject) => {
    client
      .group('apps')
      .ns(namespace)
      .statefulset(name)
      .update(spec)
      .then(
        result => {
          checkStatefulSet(client, namespace, name, 'updated', resolve)
        },
        err => {
          reject(new Error(`StatefulSet '${namespace}.${name}' failed to replace:\n\t${err.message}`))
        }
      )
  })
}

function updateConfiguration (client, namespace, name, diff) {
  return client.ns(namespace).configmap(name).patch(diff)
    .then(
      null,
      err => {
        throw new Error(`Configuration map '${namespace}.${name}' failed to update:\n\t${err.message}`)
      }
    )
}

function updateAccount (client, namespace, name, diff) {
  return client
    .ns(namespace)
    .serviceaccount(name)
    .patch(diff)
    .then(
      null,
      err => {
        throw new Error(`Account '${namespace}.${name}' failed to update:\n\t${err.message}`)
      }
    )
}

function updateDaemonSet (client, namespace, name, image, container) {
  const patch = getImagePatch(container || name, image)
  return new Promise((resolve, reject) => {
    client
      .group('extensions')
      .ns(namespace)
      .daemonset(name)
      .patch(patch)
      .then(
        result => {
          checkDaemonSet(client, namespace, name, 'update', resolve)
        },
        err => {
          reject(new Error(`DaemonSet '${namespace}.${name}' failed to upgrade:\n\t${err.message}`))
        }
      )
  })
}

function updateDeployment (client, namespace, name, diff) {
  return new Promise((resolve, reject) => {
    client
      .group('apps')
      .ns(namespace)
      .deployment(name)
      .patch(diff)
      .then(
        result => {
          checkDeployment(client, namespace, name, 'updated', resolve)
        },
        err => {
          reject(new Error(`Deployment '${namespace}.${name}' failed to update:\n\t${err.message}`))
        }
      )
  })
}

function upgradeDeployment (client, namespace, name, image, container) {
  const patch = getImagePatch(container || name, image)
  return new Promise((resolve, reject) => {
    client
      .group('apps')
      .ns(namespace)
      .deployment(name)
      .patch(patch)
      .then(
        result => {
          checkDeployment(client, namespace, name, 'updated', resolve)
        },
        err => {
          reject(new Error(`Deployment '${namespace}.${name}' failed to upgrade:\n\t${err.message}`))
        }
      )
  })
}

function updateCronJob (client, namespace, name, diff) {
  return new Promise((resolve, reject) => {
    client
      .group('batch')
      .ns(namespace)
      .cronjob(name)
      .patch(diff)
      .then(
        result => {
          checkCronJob(client, namespace, name, 'update', resolve)
        },
        err => {
          reject(new Error(`CronJob '${namespace}.${name}' failed to update:\n\t${err.message}`))
        }
      )
  })
}

function updateJob (client, namespace, name, diff) {
  return new Promise((resolve, reject) => {
    client
      .group('batch')
      .ns(namespace)
      .job(name)
      .patch(diff)
      .then(
        result => {
          checkJob(client, namespace, name, 'updated', resolve)
        },
        err => {
          reject(new Error(`Job '${namespace}.${name}' failed to update:\n\t${err.message}`))
        }
      )
  })
}

function updateService (client, namespace, name, diff) {
  return new Promise((resolve, reject) => {
    client
      .ns(namespace)
      .service(name)
      .patch(diff)
      .then(
        result => {
          checkService(client, namespace, name, 'update', resolve)
        },
        err => {
          reject(new Error(`Service '${namespace}.${name}' failed to update:\n\t${err.message}`))
        }
      )
  })
}

function updateStatefulSet (client, namespace, name, patch) {
  return new Promise((resolve, reject) => {
    client
      .group('apps')
      .ns(namespace)
      .statefulset(name)
      .patch(patch)
      .then(
        result => {
          checkStatefulSet(client, namespace, name, 'updated', resolve)
        },
        err => {
          reject(new Error(`StatefulSet '${namespace}.${name}' failed to update:\n\t${err.message}`))
        }
      )
  })
}

function upgradeStatefulSet (client, namespace, name, image, container) {
  const patch = getImagePatch(container || name, image)
  return new Promise((resolve, reject) => {
    client
      .group('apps')
      .ns(namespace)
      .statefulset(name)
      .patch(patch)
      .then(
        result => {
          checkStatefulSet(client, namespace, name, 'update', resolve)
        },
        err => {
          reject(new Error(`StatefulSet '${namespace}.${name}' failed to upgrade:\n\t${err.message}`))
        }
      )
  })
}

module.exports = function (client) {
  return {
    client: client,
    createAccount: createAccount.bind(null, client),
    createConfiguration: createConfiguration.bind(null, client),
    createCronJob: createCronJob.bind(null, client),
    createDaemonSet: createDaemonSet.bind(null, client),
    createDeployment: createDeployment.bind(null, client),
    createJob: createJob.bind(null, client),
    createNamespace: createNamespace.bind(null, client),
    createRoleBinding: createRoleBinding.bind(null, client),
    createService: createService.bind(null, client),
    createStatefulSet: createStatefulSet.bind(null, client),
    deleteAccount: deleteAccount.bind(null, client),
    deleteConfiguration: deleteConfiguration.bind(null, client),
    deleteDaemonSet: deleteDaemonSet.bind(null, client),
    deleteDeployment: deleteDeployment.bind(null, client),
    deleteJob: deleteJob.bind(null, client),
    deleteNamespace: deleteNamespace.bind(null, client),
    deleteRoleBinding: deleteRoleBinding.bind(null, client),
    deleteService: deleteService.bind(null, client),
    deleteStatefulSet: deleteStatefulSet.bind(null, client),
    getDaemonSetsByNamespace: getDaemonSetsByNamespace.bind(null, client),
    getDeploymentsByNamespace: getDeploymentsByNamespace.bind(null, client),
    getStatefulSetsByNamespace: getStatefulSetsByNamespace.bind(null, client),
    listAccounts: listAccounts.bind(null, client),
    listConfigurations: listConfigurations.bind(null, client),
    listDaemonSets: listDaemonSets.bind(null, client),
    listDeployments: listDeployments.bind(null, client),
    listStatefulSets: listStatefulSets.bind(null, client),
    listServices: listServices.bind(null, client),
    listCronJobs: listCronJobs.bind(null, client),
    listJobs: listJobs.bind(null, client),
    listNamespaces: listNamespaces.bind(null, client),
    listRoleBindings: listRoleBindings.bind(null, client),
    patchDaemonSet: patchDaemonSet.bind(null, client),
    replaceConfiguration: replaceConfiguration.bind(null, client),
    updateConfiguration: updateConfiguration.bind(null, client),
    updateCronJob: updateCronJob.bind(null, client),
    updateDaemonSet: updateDaemonSet.bind(null, client),
    updateDeployment: updateDeployment.bind(null, client),
    updateJob: updateJob.bind(null, client),
    updateService: updateService.bind(null, client),
    updateStatefulSet: updateStatefulSet.bind(null, client),
    upgradeDeployment: upgradeDeployment.bind(null, client),
    upgradeStatefulSet: upgradeStatefulSet.bind(null, client)
  }
}
