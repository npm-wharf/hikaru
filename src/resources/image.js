module.exports = function (k8) {
  return {
    name: 'image',
    actions: {
      services: {
        method: 'GET',
        url: [ ':registry/:repo/:image', ':repo/:image' ],
        handle: (env) => {
          const image = `${env.data.repo}/${env.data.image}`
          return k8.getServicesByImage(image)
            .then((result) => {
              return { data: result }
            })
        }
      },
      update: {
        method: 'POST',
        url: [ ':image', ':repo/:image' ],
        handle: (env) => {
          const image = `${env.data.repo}/${env.data.image}`
          console.log('received update for', image)
          return k8.update(image)
            .then((result) => {
              return { data: result }
            })
        }
      }
    }
  }
}
