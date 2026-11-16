#!/bin/bash
# Selects an available iPhone simulator for the newest installed iOS runtime
# matching the requested major version, and exposes udid/name/runtime as
# GitHub Actions step outputs.
#
# Usage: scripts/ci-select-ios-simulator.sh <ios-major>
set -euo pipefail

IOS_MAJOR="${1:-}"
if [[ ! "$IOS_MAJOR" =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 <ios-major>  (e.g. 27)" >&2
  exit 2
fi

echo "=== Runner environment ==="
echo "Image: ${ImageOS:-unknown} ${ImageVersion:-unknown}"
echo "Arch: $(uname -m)"
sw_vers
xcodebuild -version
echo "Developer dir: $(xcode-select -p)"

RUNTIMES_JSON="$(xcrun simctl list runtimes -j)"

ios_runtimes() {
  jq '[.runtimes[]
       | select(.isAvailable == true)
       | select((.platform // "") == "iOS" or (.name | startswith("iOS ")))]' <<<"$RUNTIMES_JSON"
}

RUNTIME="$(ios_runtimes | jq -c --arg major "$IOS_MAJOR" '
  map(select(.version | startswith($major + ".")))
  | sort_by(.version | split(".") | map(tonumber))
  | last // empty')"

if [[ -z "$RUNTIME" ]]; then
  echo "::error::No available iOS ${IOS_MAJOR}.x simulator runtime on this runner." >&2
  echo "Installed iOS runtimes:" >&2
  ios_runtimes | jq -r '.[] | "  - \(.name) (\(.identifier))"' >&2
  exit 1
fi

RUNTIME_ID="$(jq -r '.identifier' <<<"$RUNTIME")"
RUNTIME_NAME="$(jq -r '.name' <<<"$RUNTIME")"

DEVICE="$(xcrun simctl list devices available -j | jq -c --arg rt "$RUNTIME_ID" '
  (.devices[$rt] // [])
  | map(select(.name | startswith("iPhone")))
  | first // empty')"

if [[ -n "$DEVICE" ]]; then
  UDID="$(jq -r '.udid' <<<"$DEVICE")"
  NAME="$(jq -r '.name' <<<"$DEVICE")"
else
  DEVICE_TYPE="$(jq -r '
    [(.supportedDeviceTypes // [])[] | select(.name | startswith("iPhone"))]
    | first | .identifier // empty' <<<"$RUNTIME")"
  if [[ -z "$DEVICE_TYPE" ]]; then
    echo "::error::Runtime ${RUNTIME_NAME} has no iPhone device and no supported iPhone device type." >&2
    exit 1
  fi
  NAME="CI iPhone (${RUNTIME_NAME})"
  echo "No iPhone simulator for ${RUNTIME_NAME}; creating one (${DEVICE_TYPE})"
  UDID="$(xcrun simctl create "$NAME" "$DEVICE_TYPE" "$RUNTIME_ID")"
fi

echo "=== Selected simulator ==="
echo "Runtime: ${RUNTIME_NAME} (${RUNTIME_ID})"
echo "Device:  ${NAME}"
echo "UDID:    ${UDID}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "udid=${UDID}"
    echo "name=${NAME}"
    echo "runtime=${RUNTIME_NAME}"
  } >>"$GITHUB_OUTPUT"
fi
