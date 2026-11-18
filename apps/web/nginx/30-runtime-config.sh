#!/bin/sh
# Runtime config (F-FE-12) — docs/specs/infra/01-docker-compose.md#appswebdockerfile.
# Runs from /docker-entrypoint.d/ at container start (after 20-envsubst-on-templates.sh) and writes
# /usr/share/nginx/html/config.js so one image serves every environment without a rebuild.
set -eu

: "${PUBLIC_API_URL:?PUBLIC_API_URL must be set (e.g. http://localhost:18001)}"
PUBLIC_URL="${PUBLIC_URL:-}"
TARGET="${APP_CONFIG_TARGET:-/usr/share/nginx/html/config.js}"

# Escape a value for a JS double-quoted string literal (backslash, quote, '<' to avoid </script> tricks).
js_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/</\\u003c/g'
}

api_url=$(js_escape "$PUBLIC_API_URL")
public_url=$(js_escape "$PUBLIC_URL")

printf 'window.__APP_CONFIG__ = { apiUrl: "%s", publicUrl: "%s" };\n' "$api_url" "$public_url" > "$TARGET"
echo "30-runtime-config.sh: wrote $TARGET (apiUrl=$PUBLIC_API_URL)"
