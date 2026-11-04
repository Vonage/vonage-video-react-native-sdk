#!/usr/bin/env bash
set -euo pipefail

sleep 10
npm view "${PACKAGE_NAME}@${VERSION}" version --registry "$REGISTRY_URL"
