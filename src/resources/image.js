module.exports = function( k8 ) {
  return {
    name: "image",
    actions: {
      services: {
        method: "GET",
        url: [ ":registry/:repo/:image", ":repo/:image" ],
        handle: ( env ) => {
          return k8.getServicesByImage( env.data.image )
            .then( ( result ) => {
              return { data: result };
            } );
        }
      },
      update: {
        method: "POST",
        url: "",
        handle: ( env ) => {
          return k8.update( env.image )
            .then( ( result ) => {
              return { data: result };
            } );
        }
      }
    }
  }
};