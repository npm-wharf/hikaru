const _ = require( "lodash" );
const when = require( "when" );
const K8Api = require( "kubernetes-client" );

function createJob( client, namespace, jobSpec ) {
  return when.promise( ( res, rej ) => {
    client.ext.ns( namespace )
      .job.create( jobSpec, ( err, result ) => {
        if( err ) {
          console.log( "error creating job" );
          console.log( JSON.stringify( err, null, 2 ) );
          rej( err );
        } else {
          res( result );
        }
      } );
  } );
}

function deleteJob( client, namespace, jobName ) {
  return when.promise( ( res, rej ) => {
    client.ext.ns( namespace )
      .job.delete( jobName, ( err, result ) => {
        if( err ) {
          rej( err );
        } else {
          res( result );
        }
      } );
  } );
}

function getClient( config ) {
  return new K8Api.Core( {
    url: config.url,
    auth: {
      user: config.username,
      pass: config.password
    }
  } );
}

function getExtClient( config ) {
  return new K8Api.Extensions( {
    url: config.url,
    auth: {
      user: config.username,
      pass: config.password
    }
  } );
}

function getJobStatus( client, namespace, jobName ) {
  return when.promise( ( res, rej ) => {
    client.ext.ns( namespace )
      .job.get( jobName, ( err, result ) => {
        if( err ) {
          rej( err );
        } else {
          res( result.status );
        }
      } );
  } );
}

function getNamespaces( client ) {
  return when.promise( ( res, rej ) => {
    client.core.namespaces.get( ( err, list ) => {
      if( err ) {
        rej( err );
      } else {
        res( _.map( list.items, ( item ) => {
            return item.metadata.name;
        } ) );
      }
    } );
  } );
}

function getServicesByLabels( client, namespace, query ) {
  return when.promise( ( res, rej ) => {
    client.ext.ns( namespace ).deployments.matchLabels( query )
      .get( ( err, list ) => {
        if( err ) {
          rej( err );
        } else {
          let deployments = _.map( list.items, ( deployment ) => {
            return deployment.metadata.name;
          } );
          res( { namespace, services: deployments } );
        }
      } );
    } );
}

function getServicesByImage( client, dockerImage ) {
  let [ image, tag ] = dockerImage.split( ":" );
  let [ owner, repo, branch, version, build, slug ] = tag.split( "_" );
  let query = {
    owner: owner,
    repo: repo.replace( ".git", "" ),
    branch: branch
  };
  return getNamespaces( client )
    .then( ( namespaces ) => {
      let updates = _.map( namespaces, ( namespace ) => {
        return getServicesByLabels( client, namespace, query );
      } );
      return when.all( updates )
        .then( ( list ) => {
          return _.filter( list, ( l ) => l.services.length );
        } );
    } );
}

function listJobs( client, namespace ) {
  return when.promise( ( res, rej ) => {
    client.ext.ns( namespace )
      .job.get( ( err, result ) => {
        if( err ) {
          rej( err );
        } else {
          res( result );
        }
      } );
  } );
}

function updateServiceToImage( client, namespace, name, image ) {
  let update = { 
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
  };
  return when.promise( ( res, rej ) => {
    client.ext.ns( namespace ).deployments.patch( update, ( err, result ) => {
      if( err ) {
        console.log( "upgrade failed", err );
        rej( err );
      } else {
        console.log( "upgrade started" );
        res( result );
      }
    } );
  } );
}

function updateNamespace( client, dockerImage, set ) {
  let pending = _.map( set.services, ( service ) => {
    return updateServiceToImage( client, set.namespace, service, dockerImage );
  } );
  return when.all( pending ).then( () => set );
}

function updateService( client, dockerImage ) {
  return getServicesByImage( client, dockerImage )
    .then( ( sets ) => {
      let setPromises = _.map( sets, updateNamespace.bind( null, client, dockerImage ) );
      return when.all( setPromises );
    } );
}

module.exports = function( config ) {
  const client = {
    core: getClient( config ),
    ext: getExtClient( config )
  };

  return {
    client: client,
    createJob: createJob.bind( null, client ),
    deleteJob: deleteJob.bind( null, client ),
    getJobStatus: getJobStatus.bind( null, client ),
    getNamespaces: getNamespaces.bind( null, client ),
    getServicesByImage: getServicesByImage.bind( null, client ),
    getServicesByLabels: getServicesByLabels.bind( null, client ),
    listJobs: listJobs.bind( null, client ),
    update: updateService.bind( null, client )
  };
}