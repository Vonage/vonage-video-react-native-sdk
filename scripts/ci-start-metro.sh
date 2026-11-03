#!/bin/bash
# Starts Metro in the background for CI and waits until it reports ready.
# Writes the Metro log to <app-dir>/metro.log and leaves Metro running.
#
# Usage: scripts/ci-start-metro.sh <app-dir> [retries=40] [interval-seconds=3]
set -euo pipefail

APP_DIR="${1:?Usage: $0 <app-dir> [retries] [interval]}"
RETRIES="${2:-40}"
INTERVAL="${3:-3}"
STATUS_URL="http://127.0.0.1:8081/status"

cd "$APP_DIR"
nohup npm start >metro.log 2>&1 &
METRO_PID=$!
echo "Metro PID: $METRO_PID (waiting up to $((RETRIES * INTERVAL))s)"

for ((i = 1; i <= RETRIES; i++)); do
  if curl -fsS "$STATUS_URL" 2>/dev/null | grep -q "packager-status:running"; then
    echo "Metro is running on attempt $i"
    exit 0
  fi
  if ! kill -0 "$METRO_PID" 2>/dev/null; then
    echo "::error::Metro process exited before becoming ready"
    tail -n 100 metro.log || true
    exit 1
  fi
  sleep "$INTERVAL"
done

echo "::error::Metro failed to start after $RETRIES retries"
echo "=== Metro log output ==="
tail -n 150 metro.log || true
kill "$METRO_PID" 2>/dev/null || true
exit 1
