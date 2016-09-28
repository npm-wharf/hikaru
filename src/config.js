require( "dot-env" );
const URL = "K8S_URL";
const HOST = "K8S_HOST";
const TOKEN = "K8S_TOKEN";
const CA = "K8S_CA";
const CERT = "K8S_CERT";
const KEY = "K8S_KEY";
const USERNAME = "K8S_USERNAME";
const PASSWORD = "K8S_PASSWORD";

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