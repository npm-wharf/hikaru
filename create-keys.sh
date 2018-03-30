# Make keys for server
mkdir -p ./spec/integration/server
openssl genrsa -out ./spec/integration/server/privkey.pem 2048
openssl rsa -in ./spec/integration/server/privkey.pem -pubout -out ./spec/integration/server/pubkey.pem

# Make keys for client
mkdir -p ./spec/integration/client
openssl genrsa -out ./spec/integration/client/privkey.pem 2048
openssl rsa -in ./spec/integration/client/privkey.pem -pubout -out ./spec/integration/client/pubkey.pem