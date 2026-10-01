#!/bin/bash
set -e

# E2E Test Runner for local development
#
# Usage:
#   ./scripts/run-e2e-local.sh ios                  # Run all e2e tests on iOS
#   ./scripts/run-e2e-local.sh android              # Run all e2e tests on Android
#   ./scripts/run-e2e-local.sh ios subscriber       # Run only subscriber suite on iOS
#   ./scripts/run-e2e-local.sh android publisher    # Run only publisher suite on Android
#   ./scripts/run-e2e-local.sh ios --build          # Rebuild app before running tests
#
# Available suites: app, publisher, subscriber, signaling, forceMute
#
# Environment variables:
#   DETOX_DEVICE_NAME   - iOS simulator name (default: auto-detect)
#   DETOX_AVD_NAME      - Android emulator AVD name (default: auto-detect)

PLATFORM="${1:-ios}"
SUITE=""
BUILD=false

shift || true
for arg in "$@"; do
  case "$arg" in
    --build) BUILD=true ;;
    *) SUITE="$arg" ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║     E2E Test Runner (local)         ║"
echo "╠══════════════════════════════════════╣"
echo "║  Platform: $PLATFORM"
echo "║  Suite:    ${SUITE:-all}"
echo "║  Build:    $BUILD"
echo "╚══════════════════════════════════════╝"
echo ""

# --- Check prerequisites ---

# Playwright Chromium
if [ ! -d "$HOME/Library/Caches/ms-playwright" ] && [ ! -d "$HOME/.cache/ms-playwright" ]; then
  echo "→ Playwright Chromium not found. Installing..."
  npx playwright install chromium
  echo ""
fi

# iOS: applesimutils
if [ "$PLATFORM" = "ios" ]; then
  if ! command -v applesimutils &> /dev/null; then
    echo "✗ applesimutils not found. Install with:"
    echo "    brew tap wix/brew && brew install applesimutils"
    exit 1
  fi

  # Auto-detect simulator if not set
  if [ -z "$DETOX_DEVICE_NAME" ]; then
    DETOX_DEVICE_NAME=$(xcrun simctl list devices available | grep -o "iPhone [^(]*" | head -1 | xargs)
    if [ -n "$DETOX_DEVICE_NAME" ]; then
      echo "→ Auto-detected iOS simulator: $DETOX_DEVICE_NAME"
      export DETOX_DEVICE_NAME
    fi
  fi
fi

# Android: ANDROID_SDK_ROOT
if [ "$PLATFORM" = "android" ]; then
  if [ -z "$ANDROID_SDK_ROOT" ]; then
    if [ -d "$HOME/Library/Android/sdk" ]; then
      export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
    else
      echo "✗ ANDROID_SDK_ROOT not set and default path not found."
      exit 1
    fi
  fi

  # Auto-detect AVD if not set
  if [ -z "$DETOX_AVD_NAME" ]; then
    DETOX_AVD_NAME=$("$ANDROID_SDK_ROOT/emulator/emulator" -list-avds 2>/dev/null | head -1)
    if [ -n "$DETOX_AVD_NAME" ]; then
      echo "→ Auto-detected Android AVD: $DETOX_AVD_NAME"
      export DETOX_AVD_NAME
    else
      echo "✗ No Android AVDs found. Create one in Android Studio."
      exit 1
    fi
  fi
fi

# --- Start Metro if not running ---
if ! curl -fsS "http://127.0.0.1:8081/status" 2>/dev/null | grep -q "packager-status:running"; then
  echo "→ Starting Metro bundler..."
  (cd React-native-TestApp && nohup npm start > /tmp/metro-e2e.log 2>&1 &)

  for i in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:8081/status" 2>/dev/null | grep -q "packager-status:running"; then
      echo "  Metro is running (attempt $i)"
      break
    fi
    if [ "$i" -eq 60 ]; then
      echo "✗ Metro failed to start. Check /tmp/metro-e2e.log"
      exit 1
    fi
    sleep 2
  done
  echo ""
fi

# --- Build if requested ---
if [ "$BUILD" = true ]; then
  echo "→ Building app for $PLATFORM..."
  if [ "$PLATFORM" = "ios" ]; then
    npm run test:e2e:ios:build
  else
    npm run test:e2e:android:build
  fi
  echo ""
fi

# --- Run tests ---
echo "→ Running tests..."
echo ""

if [ "$PLATFORM" = "ios" ]; then
  if [ -n "$SUITE" ]; then
    npx detox test -c ios.sim.debug -- --testPathPattern "$SUITE"
  else
    npm run test:e2e:ios
  fi
else
  if [ -n "$SUITE" ]; then
    npx detox test -c android.emu.debug --record-logs all --take-screenshots failing -- --testTimeout=240000 --testPathPattern "$SUITE"
  else
    npm run test:e2e:android
  fi
fi
