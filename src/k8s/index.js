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
  const deletes = {}
  const account = require('./account')(client)
  const configuration = require('./configuration')(client)
  const cronJob = require('./cronJob')(client, deletes)
  const daemonSet = require('./daemonSet')(client, deletes)
  const deployment = require('./deployment')(client, deletes)
  const job = require('./job')(client, deletes)
  const manifest = require('./manifest')(client)
  const namespace = require('./namespace')(client)
  const networkPolicy = require('./networkPolicy')(client, deletes)
  const role = require('./role')(client)
  const roleBinding = require('./roleBinding')(client)
  const service = require('./service')(client, deletes)
  const statefulSet = require('./statefulSet')(client, deletes)

  deletes.cronJob = cronJob.delete
  deletes.daemonSet = daemonSet.delete
  deletes.deployment = deployment.delete
  deletes.job = job.delete
  deletes.networkPolicy = networkPolicy.delete
  deletes.role = role.delete
  deletes.roleBinding = roleBinding.delete
  deletes.service = service.delete
  deletes.serviceAccount = account.delete
  deletes.statefulSet = statefulSet.delete

  return {
    client: client,
    deletes: deletes,

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

    createManifest: manifest.create,
    deleteManifest: manifest.delete,
    listManifests: manifest.list,
    updateManifest: manifest.update,
    replaceManifest: manifest.replace,

    createNamespace: namespace.create,
    deleteNamespace: namespace.delete,
    listNamespaces: namespace.list,

    createNetworkPolicy: networkPolicy.create,
    deleteNetworkPolicy: networkPolicy.delete,
    getNetworkPolicysByNamespace: networkPolicy.getByNamespace,
    listNetworkPolicys: networkPolicy.list,
    patchNetworkPolicy: networkPolicy.patch,
    updateNetworkPolicy: networkPolicy.update,

    createRole: role.create,
    deleteRole: role.delete,
    listRoles: role.list,

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
