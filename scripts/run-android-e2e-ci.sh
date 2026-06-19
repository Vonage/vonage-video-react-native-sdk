#!/bin/sh
set -eu

nohup npm --prefix e2e/E2ETestingApp start > metro.log 2>&1 &
echo "Metro started"

for i in $(seq 1 120); do
  if curl -fsS "http://127.0.0.1:8081/status" 2>/dev/null | grep -q "packager-status:running"; then
    echo "Metro is running on attempt $i"
    break
  fi

  if [ "$i" -eq 120 ]; then
    echo "Metro failed to start"
    tail -n 100 metro.log || true
    exit 1
  fi

  sleep 3
done

npm run test:e2e:android