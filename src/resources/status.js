module.exports = function (config) {
  return {
    name: '_status',
    middleware: [
      'auth.bearer',
      'auth.cert'
    ],
    actions: {
      ping: {
        method: 'GET',
        handle: (env) => {
          return {status: 200, data: 'Ok'}
        }
      }
    }
  }
}
