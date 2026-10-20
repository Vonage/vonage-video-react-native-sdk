#!/usr/bin/env bash
# Builds the OpentokReactNative pod inside React-native-TestApp in one Swift
# language mode and fails on any Swift concurrency diagnostic in ios/.
#
#   scripts/ios-swift-language-mode-check.sh 5   # Swift 5 + complete checking
#   scripts/ios-swift-language-mode-check.sh 6   # Swift 6
#
# Requires `pod install` in React-native-TestApp/ios. The compiler invocation in
# the log must show the requested mode, so a cached or misconfigured build
# cannot pass without evidence.
set -euo pipefail

MODE="${1:?usage: $0 <5|6>}"
case "$MODE" in 5|6) ;; *) echo "mode must be 5 or 6" >&2; exit 2 ;; esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_IOS="$ROOT/React-native-TestApp/ios"
DERIVED_DATA="${DERIVED_DATA:-$APP_IOS/build/swift$MODE}"
LOG_DIR="${LOG_DIR:-$ROOT/artifacts/swift-language-modes}"
LOG="$LOG_DIR/swift$MODE.log"
mkdir -p "$LOG_DIR"

# Recompile the SDK sources even when derived data is restored from a cache.
touch "$ROOT"/ios/*.swift "$ROOT"/ios/Utils/*.swift

set +e
xcodebuild build \
  -workspace "$APP_IOS/ReactNativeTesApp.xcworkspace" \
  -scheme OpentokReactNative \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$DERIVED_DATA" \
  CODE_SIGNING_ALLOWED=NO \
  OTRN_SWIFT_LANGUAGE_MODE="$MODE" \
  OTRN_STRICT_CONCURRENCY=complete \
  > "$LOG" 2>&1
STATUS=$?
set -e

xcodebuild -version
echo "Build log: $LOG"

if [ "$STATUS" -ne 0 ]; then
  grep -E "error:" "$LOG" | sort -u | head -50 || true
  echo "xcodebuild failed in Swift $MODE mode (exit $STATUS)" >&2
  exit "$STATUS"
fi

DRIVER=$(grep -A2 -E "^SwiftDriver OpentokReactNative " "$LOG" | grep -E "swiftc .*-module-name OpentokReactNative" || true)
if [ -z "$DRIVER" ]; then
  echo "No OpentokReactNative Swift compilation found in the log" >&2
  exit 1
fi
if ! grep -qE -- "-swift-version $MODE( |$)" <<<"$DRIVER"; then
  echo "OpentokReactNative was not compiled with -swift-version $MODE" >&2
  exit 1
fi
if [ "$MODE" = 5 ] && ! grep -q -- "-enable-upcoming-feature StrictConcurrency" <<<"$DRIVER"; then
  echo "Swift 5 build did not enable complete concurrency checking" >&2
  exit 1
fi

CONCURRENCY='Swift 6 language mode|[Ss]endable|actor-isolated|data race|concurrency-safe|nonisolated|sending '
DIAGNOSTICS=$(grep -E "^$ROOT/ios/.*: (warning|error): " "$LOG" | grep -E "$CONCURRENCY" | sort -u || true)
if [ -n "$DIAGNOSTICS" ]; then
  echo "$DIAGNOSTICS"
  echo "Swift concurrency diagnostics found in Swift $MODE mode" >&2
  exit 1
fi

echo "OpentokReactNative: Swift $MODE mode, complete concurrency checking, no concurrency diagnostics"
