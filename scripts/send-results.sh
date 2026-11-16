#!/usr/bin/env bash
# Sends results/*/artifacts/jest-results-<platform>.json to ClientSDKTests, one dispatch per platform.
# Env: VERSION (release branch name), CLIENTSDKTESTS_DISPATCH_TOKEN.
set -euo pipefail
ios=$(ls results/*/artifacts/jest-results-ios.json 2>/dev/null || true)
android=$(ls results/*/artifacts/jest-results-android.json 2>/dev/null || true)
if [ -n "$ios" ]; then node scripts/dispatch-test-results.js --platform ios --version "$VERSION" $ios; else echo "::warning::No iOS results"; fi
if [ -n "$android" ]; then node scripts/dispatch-test-results.js --platform android --version "$VERSION" $android; else echo "::warning::No Android results"; fi
