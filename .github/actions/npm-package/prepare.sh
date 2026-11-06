#!/usr/bin/env bash
set -euo pipefail

if [ "$(jq -r .name package.json)" != "$PACKAGE_NAME" ]; then
  echo "📝 Renaming package to $PACKAGE_NAME"
  jq --arg name "$PACKAGE_NAME" '.name = $name' package.json > package.json.tmp
  mv package.json.tmp package.json
  npm install --package-lock-only --ignore-scripts
fi

npm ci
npm run prepare

PACKAGE_VERSION=$(npm run version:local --silent)
if [ "$PACKAGE_VERSION" != "$VERSION" ]; then
  echo "❌ Error: Version mismatch!"
  echo "Package.json has version $PACKAGE_VERSION but branch name indicates $VERSION"
  exit 1
fi
