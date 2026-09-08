#!/bin/sh
set -eu

DEVICE_ID="emulator-5554"

wait_for_adb() {
  echo "Waiting for ADB device connection..."
  adb wait-for-device

  for i in $(seq 1 60); do
    state=$(adb -s "$DEVICE_ID" get-state 2>/dev/null || true)

    if [ "$state" = "device" ]; then
      echo "ADB device is online on attempt $i"
      return 0
    fi

    if [ "$state" = "offline" ]; then
      echo "ADB device is offline on attempt $i, restarting adb server..."
      adb kill-server || true
      adb start-server || true
      adb wait-for-device || true
    fi

    sleep 2
  done

  echo "ADB device did not become ready"
  return 1
}

wait_for_boot_completed() {
  echo "Waiting for sys.boot_completed..."

  for i in $(seq 1 120); do
    boot_completed=$(adb -s "$DEVICE_ID" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)

    if [ "$boot_completed" = "1" ]; then
      echo "sys.boot_completed=1 on attempt $i"
      return 0
    fi

    sleep 2
  done

  echo "sys.boot_completed never reached 1"
  return 1
}

wait_for_package_manager() {
  echo "Waiting for package manager readiness..."

  for i in $(seq 1 90); do
    if adb -s "$DEVICE_ID" shell cmd package list packages >/dev/null 2>&1; then
      echo "Package manager ready on attempt $i"
      return 0
    fi

    sleep 2
  done

  echo "Package manager did not become ready"
  return 1
}

unlock_emulator() {
  echo "Unlocking emulator..."
  adb -s "$DEVICE_ID" shell input keyevent 82 || true
}

if ! curl -fsS "http://127.0.0.1:8081/status" 2>/dev/null | grep -q "packager-status:running"; then
  echo "Metro not reachable in emulator step, starting it now..."
  nohup npm --prefix React-native-TestApp start > metro-android.log 2>&1 &
fi

for i in $(seq 1 120); do
  if curl -fsS "http://127.0.0.1:8081/status" 2>/dev/null | grep -q "packager-status:running"; then
    echo "Metro is running on attempt $i"
    break
  fi

  if [ "$i" -eq 120 ]; then
    echo "Metro failed to start"
    tail -n 150 metro-android.log 2>/dev/null || true
    tail -n 150 React-native-TestApp/metro.log 2>/dev/null || true
    exit 1
  fi

  sleep 3
done

wait_for_adb
wait_for_boot_completed
wait_for_package_manager
unlock_emulator

echo "Configuring adb reverse for Metro..."
adb -s "$DEVICE_ID" reverse tcp:8081 tcp:8081

adb -s "$DEVICE_ID" logcat -c || true

# Full, unfiltered logcat (verbose, for deep debugging).
adb -s "$DEVICE_ID" logcat -v time > android-logcat.txt 2>&1 &
LOGCAT_PID=$!

# Scoped crash/app logcat: only the app's own tags plus crash/native-fault
# channels. This is the file to read first — it isolates a real app crash
# (FATAL EXCEPTION / native SIGSEGV) from a lost Detox<->app connection.
#   AndroidRuntime:E  -> uncaught Java/Kotlin exceptions (FATAL EXCEPTION)
#   DEBUG:V / libc:F  -> native crashes (tombstones, SIGSEGV/SIGABRT)
#   ReactNativeJS / OTRN* / opentok -> app + SDK lifecycle
adb -s "$DEVICE_ID" logcat -v threadtime \
  AndroidRuntime:E DEBUG:V libc:F \
  ReactNativeJS:V OTRN-LIFECYCLE:V OTRN-DIAG:V opentok:V \
  '*:S' > android-crash-logcat.txt 2>&1 &
CRASH_LOGCAT_PID=$!

# Set FAST=1 to run the fail-fast variant (shorter hook timeout, no retries).
# Useful for debugging a broken run without waiting out 240s-per-suite timeouts.
E2E_NPM_SCRIPT="test:e2e:android"
if [ "${FAST:-0}" = "1" ]; then
  E2E_NPM_SCRIPT="test:e2e:android:fast"
  echo "FAST=1 set — using $E2E_NPM_SCRIPT (90s hook timeout, no retries)"
fi

if ! npm run "$E2E_NPM_SCRIPT"; then
  echo "=== Detox failed: collecting Android diagnostics ==="
  adb -s "$DEVICE_ID" devices || true
  adb -s "$DEVICE_ID" shell getprop ro.build.version.release || true
  # Is the app process still alive? If pidof returns a PID, the app did NOT
  # crash and the failure is a lost Detox<->app connection, not an app fault.
  echo "--- app process (pidof com.reactnativetesapp) ---"
  adb -s "$DEVICE_ID" shell pidof com.reactnativetesapp || echo "(no app process — app is not running)"
  # Any tombstones (native crashes) recorded?
  echo "--- tombstones ---"
  adb -s "$DEVICE_ID" shell ls -la /data/tombstones 2>/dev/null || true
  adb -s "$DEVICE_ID" shell dumpsys activity activities > android-dumpsys-activities.txt 2>&1 || true
  adb -s "$DEVICE_ID" shell dumpsys package com.reactnativetesapp > android-dumpsys-package.txt 2>&1 || true
  kill "$LOGCAT_PID" 2>/dev/null || true
  kill "$CRASH_LOGCAT_PID" 2>/dev/null || true
  exit 1
fi

kill "$LOGCAT_PID" 2>/dev/null || true
kill "$CRASH_LOGCAT_PID" 2>/dev/null || true
