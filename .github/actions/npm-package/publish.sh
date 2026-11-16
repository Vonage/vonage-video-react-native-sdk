#!/usr/bin/env bash
set -euo pipefail

ARGS=(--ignore-scripts --registry "$REGISTRY_URL")

case "$MODE" in
  verify)
    echo "🔍 DRY RUN MODE - $PACKAGE_NAME @ $REGISTRY_URL"
    ARGS+=(--dry-run)
    ;;
  publish)
    echo "🚀 Publishing $PACKAGE_NAME@$VERSION to $REGISTRY_URL"
    ;;
  *)
    echo "::error::Unknown mode '$MODE' (expected verify or publish)"
    exit 1
    ;;
esac

if [ -n "${NPM_TAG:-}" ]; then
  echo "📦 Tag: $NPM_TAG"
  ARGS+=(--tag "$NPM_TAG")
else
  echo "📦 No explicit tag (using npm default)"
fi

if [ -n "${PUBLISH_TOKEN:-}" ]; then
  export NODE_AUTH_TOKEN="$PUBLISH_TOKEN"
fi

npm publish "$TARBALL" "${ARGS[@]}"
