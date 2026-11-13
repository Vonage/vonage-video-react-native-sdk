#!/usr/bin/env bash
set -euo pipefail

if [ -n "${REGISTRY_TOKEN:-}" ]; then
  export NODE_AUTH_TOKEN="$REGISTRY_TOKEN"
fi

ERROR_LOG="${RUNNER_TEMP:-/tmp}/npm-view-error.log"
if PUBLISHED_VERSION=$(npm view "${PACKAGE_NAME}@${VERSION}" version --registry "$REGISTRY_URL" 2>"$ERROR_LOG"); then
  if [ "$PUBLISHED_VERSION" == "$VERSION" ]; then
    echo "⚠️  Warning: $PACKAGE_NAME@$VERSION is already published on $REGISTRY_URL, skipping"
    echo "skip=true" >> "$GITHUB_OUTPUT"
  elif [ -z "$PUBLISHED_VERSION" ]; then
    echo "📦 $PACKAGE_NAME@$VERSION is not published on $REGISTRY_URL yet"
    echo "skip=false" >> "$GITHUB_OUTPUT"
  else
    echo "::error::Unexpected version '$PUBLISHED_VERSION' for $PACKAGE_NAME@$VERSION on $REGISTRY_URL"
    exit 1
  fi
elif grep -q "code E404" "$ERROR_LOG"; then
  echo "📦 $PACKAGE_NAME@$VERSION is not published on $REGISTRY_URL yet"
  echo "skip=false" >> "$GITHUB_OUTPUT"
elif [ "$MODE" == "verify" ] && grep -Eq "code E40[13]" "$ERROR_LOG"; then
  echo "::warning::Could not check $PACKAGE_NAME@$VERSION on $REGISTRY_URL with the read-only token; the publish job will re-check"
  echo "skip=false" >> "$GITHUB_OUTPUT"
else
  cat "$ERROR_LOG"
  echo "::error::Could not check whether $PACKAGE_NAME@$VERSION is published on $REGISTRY_URL"
  exit 1
fi
