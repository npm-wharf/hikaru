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
        middleware: [
          ( env, next ) => {
            env.type = types[ env.headers[ "Content-Type" ] ];
            next();
          }
        ],
        handle: [
          {
            when: { type: "json" },
            handle: ( env ) => {
              try {
                return k8.createJob( env.data.body )
                  .then( ( result ) => {
                    return { data: result };
                  } );
              } catch( ex ) {
                return { status: 400, data: "invalid job specification submitted" };
              }
            }
          },
          {
            when: { type: "yaml" },
            handle: ( env ) => {
              try {
                let job = yaml.safeLoad( env.data.body );
                return k8.createJob( job )
                  .then( ( result ) => {
                    return { data: result };
                  } );
              } catch( ex ) {
                return { status: 400, data: "invalid job specification submitted" };
              }
            }
          }
        ]
      },
      status: {
        method: "GET",
        url: ":namespace/:jobName",
        handle: ( env ) => {
          return k8.getJobStatus( env.data.namespace, env.data.jobName )
            .then( ( result ) => {
              return { data: result };
            } );
        }
      },
      stop: {
        method: "DELETE",
        url: ":namespace/:jobName",
        handle: ( env ) => {
          return k8.deleteJob( env.data.namespace, env.data.jobName )
            .then( ( result ) => {
              return { data: result };
            } );
        }
      },
    }
  }
};