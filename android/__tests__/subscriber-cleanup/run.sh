#!/usr/bin/env bash
set -euo pipefail

test_dir="$(cd "$(dirname "$0")" && pwd)"
android_dir="$(cd "$test_dir/../.." && pwd)"
test_output="$(mktemp -d)"
trap 'rm -rf "$test_output"' EXIT

# Compile the production helper directly with SDK doubles: no JNI or device needed.
java_bin="${JAVA_HOME:+$JAVA_HOME/bin/}"
"${java_bin}javac" --release 17 -d "$test_output" \
  "$android_dir/src/main/java/com/opentokreactnative/utils/SubscriberCleanup.java" \
  "$test_dir/com/opentok/android/Session.java" \
  "$test_dir/com/opentok/android/Subscriber.java" \
  "$test_dir/com/opentokreactnative/OTRN.java" \
  "$test_dir/SubscriberCleanupTest.java"
"${java_bin}java" -cp "$test_output" SubscriberCleanupTest
