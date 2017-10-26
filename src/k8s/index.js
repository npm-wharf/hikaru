const _ = require('lodash')
const Promise = require('bluebird')

function getLoadBalancers (ns, svc, namespace) {
  if (namespace) {
    return svc.list(namespace)
      .then(
        services => {
          return services.items.reduce((list, service) => {
            const loadBalancer = service.status.loadBalancer || {}
            if (loadBalancer.ingress && loadBalancer.ingress.length) {
              list.push(service)
            }
            return list
          }, [])
        }
      )
  } else {
    return ns.list()
      .then(
        list => Promise.map(
            list,
            getLoadBalancers.bind(null, ns, svc)
          )
      ).then(
        lists => _.flatten(lists)
      )
  }
}

module.exports = function (client) {
  const account = require('./account')(client)
  const configuration = require('./configuration')(client)
  const cronJob = require('./cronJob')(client)
  const daemonSet = require('./daemonSet')(client)
  const deployment = require('./deployment')(client)
  const job = require('./job')(client)
  const namespace = require('./namespace')(client)
  const roleBinding = require('./roleBinding')(client)
  const service = require('./service')(client)
  const statefulSet = require('./statefulSet')(client)

  return {
    client: client,

    createAccount: account.create,
    deleteAccount: account.delete,
    listAccounts: account.list,

    createConfiguration: configuration.create,
    deleteConfiguration: configuration.delete,
    listConfigurations: configuration.list,
    replaceConfiguration: configuration.replace,
    updateConfiguration: configuration.update,

    createCronJob: cronJob.create,
    deleteCronJob: cronJob.delete,
    listCronJobs: cronJob.list,
    updateCronJob: cronJob.update,

    createDaemonSet: daemonSet.create,
    deleteDaemonSet: daemonSet.delete,
    getDaemonSetsByNamespace: daemonSet.getByNamespace,
    listDaemonSets: daemonSet.list,
    patchDaemonSet: daemonSet.patch,
    updateDaemonSet: daemonSet.update,

    createDeployment: deployment.create,
    deleteDeployment: deployment.delete,
    getDeploymentsByNamespace: deployment.getByNamespace,
    listDeployments: deployment.list,
    updateDeployment: deployment.update,
    upgradeDeployment: deployment.upgrade,

    createJob: job.create,
    deleteJob: job.delete,
    listJobs: job.list,
    updateJob: job.update,

    createNamespace: namespace.create,
    deleteNamespace: namespace.delete,
    listNamespaces: namespace.list,

    createRoleBinding: roleBinding.create,
    deleteRoleBinding: roleBinding.delete,
    listRoleBindings: roleBinding.list,

    createService: service.create,
    deleteService: service.delete,
    listServices: service.list,
    updateService: service.update,

    createStatefulSet: statefulSet.create,
    deleteStatefulSet: statefulSet.delete,
    getStatefulSetsByNamespace: statefulSet.getByNamespace,
    listStatefulSets: statefulSet.list,
    upgradeStatefulSet: statefulSet.upgrade,
    updateStatefulSet: statefulSet.update,

    getLoadBalancers: getLoadBalancers.bind(null, namespace, service)
  }
}
