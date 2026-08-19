#!/bin/sh
set -e

: "${PORT:=8080}"
: "${BACKEND_INTERNAL_URL:?BACKEND_INTERNAL_URL precisa apontar pro backend (ex: http://backend.railway.internal:3333)}"

envsubst '${PORT} ${BACKEND_INTERNAL_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

exec "$@"
