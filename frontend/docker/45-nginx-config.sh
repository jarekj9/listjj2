#!/bin/sh
# Keep Nginx's request-body cap above the backend's file limit for multipart overhead.
set -eu

max_upload_mb=${MAX_UPLOAD_MB:-20}
case "$max_upload_mb" in
  ''|*[!0-9]*) echo "MAX_UPLOAD_MB must be a positive integer" >&2; exit 1 ;;
esac
if [ "$max_upload_mb" -lt 1 ]; then
  echo "MAX_UPLOAD_MB must be a positive integer" >&2
  exit 1
fi

client_max_body_size="$((max_upload_mb + 1))m"
sed "s/@CLIENT_MAX_BODY_SIZE@/$client_max_body_size/" \
  /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
