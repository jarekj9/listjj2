#!/bin/sh
# Runs at container start (official nginx image hook). Writes runtime config for the SPA.
set -e

cat > /usr/share/nginx/html/config.js <<EOF
window.LISTJJ_CONFIG = {
  googleClientId: "${GOOGLE_CLIENT_ID:-}",
  microsoftClientId: "${MICROSOFT_CLIENT_ID:-}",
  microsoftTenantId: "${MICROSOFT_TENANT_ID:-common}"
};
EOF
