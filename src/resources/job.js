const yaml = require('js-yaml');
const _ = require( "lodash" );
const types = {
  "application/json": "json",
  "application/yaml": "yaml",
  "application/yml": "yaml"
};

module.exports = function( k8 ) {
  return {
    name: "job",
    actions: {
      list: {
        method: "GET",
        url: ":namespace",
        handle: ( env ) => {
          return k8.listJobs( env.data.namespace )
            .then( ( result ) => {
              let list = _.map( result.items, ( item ) => item.metadata.name );
              return { data: list };
            } );
        }
      },
      schedule: {
        method: "POST",
        url: "",
        handle: ( env ) => {
          let type = types[ env.headers[ "content-type" ] ];
          let job = env.data;
          if( type === "yaml" || type === "yml" ) {
            try {
              job = yaml.safeLoad( env.data );
            } catch( ex ) {
              return { status: 400, data: "invalid job specification submitted" };
            }
          }
          return k8.createJob( job )
            .then( ( result ) => {
              return { data: result };
            } );
        }
      },
      status: {
        method: "GET",
        url: ":namespace/:jobName",
        handle: ( env ) => {
          return k8.getJobStatus( env.data.namespace, env.data.jobName )
            .then( 
              ( result ) => { return { data: result }; },
              ( err ) => { return { status: 404, data: `job ${env.data.jobName} not found in namespace ${env.data.namespace}` } }
            );
        }
      },
      stop: {
        method: "DELETE",
        url: ":namespace/:jobName",
        handle: ( env ) => {
          return k8.deleteJob( env.data.namespace, env.data.jobName )
            .then( 
              ( result ) => { return { data: result }; },
              ( err ) => { return { status: 404, data: `job ${env.data.jobName} not found in namespace ${env.data.namespace}` } }
            );
        }
      },
    }
  }
};