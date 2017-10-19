#!/bin/ash

openssl req -x509 \
  -nodes \
  -days 365 \
  -newkey rsa:2048 \
  -keyout ./self-signed.key \
  -out ./self-signed.crt \
  -subj "/C=$COUNTRY/ST=$STATE/L=$LOCAL/O=$ORGANIZATION/OU=$UNIT/CN=$FQN/emailAddress=$EMAIL"

cat ./self-signed.crt ./self-signed.key > ./self-signed.pem

cat ./secret-template.json | \
	sed "s/NAMESPACE/${NAMESPACE}/" | \
	sed "s/NAME/${SECRET}/" | \
	sed "s/TLSCERT/$(cat ./self-signed.crt | base64 | tr -d '\n')/" | \
	sed "s/TLSKEY/$(cat ./self-signed.key |  base64 | tr -d '\n')/" | \
	sed "s/TLSPEM/$(cat ./self-signed.pem |  base64 | tr -d '\n')/" \
	> ./secret.json

curl -v --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
  -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
  -H "Accept: application/json, */*" \
  -H "Content-Type: application/json" \
  -k -v -X POST \
  -d @./secret.json \
  https://kubernetes/api/v1/namespaces/${NAMESPACE}/secrets/${SECRET}
