#!/bin/sh
set -eu

if ! curl -fsS "http://127.0.0.1:8081/status" 2>/dev/null | grep -q "packager-status:running"; then
  echo "Metro not reachable in emulator step, starting it now..."
  nohup npm --prefix e2e/E2ETestingApp start > metro-android.log 2>&1 &
fi

for i in $(seq 1 120); do
  if curl -fsS "http://127.0.0.1:8081/status" 2>/dev/null | grep -q "packager-status:running"; then
    echo "Metro is running on attempt $i"
    break
  fi

  if [ "$i" -eq 120 ]; then
    echo "Metro failed to start"
    tail -n 150 metro-android.log 2>/dev/null || true
    tail -n 150 e2e/E2ETestingApp/metro.log 2>/dev/null || true
    exit 1
  fi

  sleep 3
done

npm run test:e2e:android -- --record-logs all --take-screenshots failing
