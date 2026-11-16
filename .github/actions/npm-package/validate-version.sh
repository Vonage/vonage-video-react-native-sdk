#!/usr/bin/env bash
set -euo pipefail

if [[ ! "${VERSION:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta)(\.[0-9]+)*)?$ ]]; then
  printf "::error::Invalid release version '%s' (expected X.Y.Z, X.Y.Z-alpha[.N] or X.Y.Z-beta[.N])\n" "${VERSION:-}"
  exit 1
fi

if [[ "$VERSION" == *"-alpha"* ]]; then
  echo "tag=alpha" >> "$GITHUB_OUTPUT"
  echo "📦 Publishing with tag: alpha"
elif [[ "$VERSION" == *"-beta"* ]]; then
  echo "tag=beta" >> "$GITHUB_OUTPUT"
  echo "📦 Publishing with tag: beta"
else
  echo "tag=" >> "$GITHUB_OUTPUT"
  echo "📦 Publishing without explicit tag (npm default)"
fi
