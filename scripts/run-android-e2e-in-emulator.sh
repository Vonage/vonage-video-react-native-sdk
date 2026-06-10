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

adb -s emulator-5554 logcat -c || true
adb -s emulator-5554 logcat -v time > android-logcat.txt 2>&1 &
LOGCAT_PID=$!

if ! npm run test:e2e:android; then
  echo "=== Detox failed: collecting Android diagnostics ==="
  adb -s emulator-5554 devices || true
  adb -s emulator-5554 shell getprop ro.build.version.release || true
  adb -s emulator-5554 shell pidof com.e2etestingapp || true
  adb -s emulator-5554 shell dumpsys activity activities > android-dumpsys-activities.txt 2>&1 || true
  adb -s emulator-5554 shell dumpsys package com.e2etestingapp > android-dumpsys-package.txt 2>&1 || true
  tail -n 400 android-logcat.txt || true
  kill "$LOGCAT_PID" 2>/dev/null || true
  exit 1
fi

kill "$LOGCAT_PID" 2>/dev/null || true
