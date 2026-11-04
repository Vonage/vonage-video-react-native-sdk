#!/usr/bin/env bash
set -euo pipefail

PACK_DIR="${RUNNER_TEMP:-/tmp}/npm-pack"
rm -rf "$PACK_DIR"
mkdir -p "$PACK_DIR"

npm pack --ignore-scripts --pack-destination "$PACK_DIR"

TARBALLS=("$PACK_DIR"/*.tgz)
if [ "${#TARBALLS[@]}" -ne 1 ] || [ ! -f "${TARBALLS[0]}" ]; then
  echo "::error::Expected exactly one tarball in $PACK_DIR"
  exit 1
fi

echo "tarball=${TARBALLS[0]}" >> "$GITHUB_OUTPUT"
