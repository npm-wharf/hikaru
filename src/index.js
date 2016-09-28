const config = require( "./config" )();
const k8 = require( "./k8s" )( config );
const fount = require( "fount" );
const deftly = require( "deftly" );
const express = require( "./express" );
const service = require( "./service" );

// k8.update( "646934428650.dkr.ecr.us-west-2.amazonaws.com/lucro/marketplace:arobson_lucro.git_staging_0.1.0_1_7dcc011c" );

config.http = {
  apiPrefix: "/api",
  configure: express.configure
};

const dependencies = {
  fount,
  express,
  config,
  k8
};

fount( {
  default: dependencies,
  resources: dependencies
} );

fount.inject( service.start );