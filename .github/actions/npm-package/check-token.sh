#!/usr/bin/env bash
set -euo pipefail

TOKEN="${NODE_AUTH_TOKEN:-}"
NAME="Publish token for $REGISTRY_URL"

if [ -z "$TOKEN" ]; then
  echo "::error::$NAME is not set (is the secret defined in the release environment?)"
  exit 1
fi

auth_curl() {
  printf 'header = "Authorization: Bearer %s"\n' "$TOKEN" | curl --config - "$@"
}

print_expiry() {
  local EXPIRY="$1" EXPIRY_TS NOW_TS DAYS_LEFT
  EXPIRY_TS=$(date -d "$EXPIRY" +%s 2>/dev/null) || { echo "::warning::$NAME expires on $EXPIRY"; return; }
  NOW_TS=$(date +%s)
  DAYS_LEFT=$(( (EXPIRY_TS - NOW_TS) / 86400 ))
  echo "::warning::$NAME expires on $(date -u -d "@$EXPIRY_TS" '+%Y-%m-%d %H:%M:%S UTC') ($DAYS_LEFT days left)"
}

if [[ "$REGISTRY_URL" == *"npm.pkg.github.com"* ]]; then
  HEADERS=$(mktemp)
  trap 'rm -f "$HEADERS"' EXIT

  STATUS=$(auth_curl -s -o /dev/null -D "$HEADERS" -w '%{http_code}' https://api.github.com/user || true)
  if [ "$STATUS" != "200" ]; then
    echo "::error::$NAME is invalid or expired (HTTP $STATUS)"
    exit 1
  fi
  echo "✅ $NAME is valid"

  SCOPES=$(grep -i '^x-oauth-scopes:' "$HEADERS" | cut -d' ' -f2- | tr -d '\r' || true)
  EXPIRY=$(grep -i '^github-authentication-token-expiration:' "$HEADERS" | cut -d' ' -f2- | tr -d '\r' || true)

  if ! echo "$SCOPES" | grep -Eq '(^|[ ,])write:packages([ ,]|$)'; then
    echo "::error::$NAME is missing the write:packages scope"
    exit 1
  fi
  if [ -n "$EXPIRY" ]; then
    print_expiry "$EXPIRY"
  else
    echo "::warning::$NAME has no expiration date"
  fi
else
  if ! npm whoami --registry "$REGISTRY_URL" >/dev/null 2>&1; then
    echo "::error::$NAME is invalid or expired"
    exit 1
  fi
  echo "✅ $NAME is valid"

  REDACTED="${TOKEN:0:8}...${TOKEN: -4}"
  EXPIRY=""
  PAGE=0
  while [ -z "$EXPIRY" ] && [ "$PAGE" -lt 10 ]; do
    RESPONSE=$(auth_curl -sf "https://registry.npmjs.org/-/npm/v1/tokens?page=$PAGE&perPage=100") || break
    [ "$(echo "$RESPONSE" | jq '.objects | length')" -gt 0 ] || break
    EXPIRY=$(echo "$RESPONSE" | jq -r --arg t "$REDACTED" '[.objects[] | select(.token == $t) | .expiry // empty] | first // empty')
    PAGE=$((PAGE + 1))
  done

  if [ -n "$EXPIRY" ]; then
    print_expiry "$EXPIRY"
  else
    echo "::warning::$NAME expiry unavailable (token cannot list account tokens, or has no expiry)"
  fi
fi
