#!/bin/ash

apk add curl --no-cache

python -m SimpleHTTPServer 80 &
PID=$!
certbot certonly --webroot -w ./ -n --agree-tos --email ${EMAIL} --no-self-upgrade -d ${DOMAINS}
kill $PID

CERTPATH=/etc/letsencrypt/live/

ls $CERTPATH || exit 1

cat ./secret-template.json | \
    sed "s/NAMESPACE/${NAMESPACE}/" | \
    sed "s/NAME/${SECRET}/" | \
    sed "s/TLSCERT/$(cat ${CERTPATH}/cert.pem | base64 | tr -d '\n')/" | \
    sed "s/TLSKEY/$(cat ${CERTPATH}/privkey.pem |  base64 | tr -d '\n')/" | \
    sed "s/TLSPEM/$(cat ${CERTPATH}/fullchain.pem |  base64 | tr -d '\n')/" \
    > ./secret.json

ls ./secret.json || exit 1

# update secret
curl -v --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
  -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
  -H "Accept: application/json, */*" \
  -H "Content-Type: application/strategic-merge-patch+json" \
  -d @./secret.json \
  https://kubernetes/api/v1/namespaces/${NAMESPACE}/secrets/${SECRET}

cat /deployment-patch-template.json | \
    sed "s/TLSUPDATED/$(date)/" | \
    sed "s/NAMESPACE/${NAMESPACE}/" | \
    sed "s/NAME/${DEPLOYMENT}/" \
    > /deployment-patch.json

ls /deployment-patch.json || exit 1

# update pod spec on ingress deployment to trigger redeploy
# curl -v --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" -k -v -XPATCH  -H "Accept: application/json, */*" -H "Content-Type: application/strategic-merge-patch+json" -d @/deployment-patch.json https://kubernetes/apis/extensions/v1beta1/namespaces/${NAMESPACE}/deployments/${DEPLOYMENT}
