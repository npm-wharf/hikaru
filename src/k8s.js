const _ = require( "lodash" );
const when = require( "when" );
const K8Api = require( "kubernetes-client" );

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

function updateService( client, dockerImage ) {
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
      return when.all( updates );
    } )
    .then( ( sets ) => {
      return _.map( sets, ( set ) => {
        if( set.services.length ) {
          let pending = _.map( set.services, ( service ) => {
            return updateServiceToImage( client, set.namespace, service, dockerImage );
          } );
          return when.all( pending )
            .then( () => {
              return set;
            } );
        } else {
          return when( [] );
        }
      } );
    } );
}

module.exports = function( config ) {
  const client = {
    core: getClient( config ),
    ext: getExtClient( config )
  };

  return {
    client: client,
    getNamespaces: getNamespaces.bind( null, client ),
    getServicesByImage: getServicesByImage.bind( null, client ),
    getServicesByLabels: getServicesByLabels.bind( null, client ),
    update: updateService.bind( null, client )
  };
}