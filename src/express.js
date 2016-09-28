const bodyParser = require( "body-parser" );
const express = require( "express" );
const when = require( "when" );
const info = require( "../package.json" );

function configure( state ) {
  const app = state.express;

  app.use( infoHeaders );
  app.use( bodyParser.json() );
  app.use( bodyParser.json( { type: "application/*+json" } ) );

  return when.resolve();
}

function infoHeaders( req, res, next ) {
  res.set( "X-Service-Version", info.version );
  next();
}

module.exports = function() {
  return {
    configure: configure
  };
}