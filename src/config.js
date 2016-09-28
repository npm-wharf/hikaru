require( "dot-env" );
const URL = "K8S-URL";
const HOST = "K8S-HOST";
const TOKEN = "K8S-TOKEN";
const CA = "K8S-CA";
const CERT = "K8S-CERT";
const KEY = "K8S-KEY";
const USERNAME = "K8S-USERNAME";
const PASSWORD = "K8S-PASSWORD";

module.exports = function() {
  let url = process.env[ URL ];
  if( !url ) {
    url = `https://${ process.env[ HOST ] }`
  }
  return {
    url: url,
    username: process.env[ USERNAME ],
    password: process.env[ PASSWORD ],
    ca: process.env[ CA ],
    token: process.env[ TOKEN ],
    transports: [ "deftly-express" ],
    resources: [ "./src/resources/*.js" ],
    plugins: [ "./src/plugins/*.js" ],
    middleware: [ "./src/middleware/*.js" ],
    logging: {
      level: 4
    }
  };
}