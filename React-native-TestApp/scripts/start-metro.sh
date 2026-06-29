#!/bin/bash

# Kill any existing Metro process on port 8081
lsof -ti:8081 | xargs kill -9 2>/dev/null || true

# Wait a moment for port to be released
sleep 1

# Start Metro in the background
nohup npm start > /tmp/metro.log 2>&1 &

# Wait for Metro to start (check if port is listening)
echo "Starting Metro bundler..."
for i in {1..20}; do
  if lsof -i:8081 >/dev/null 2>&1; then
    echo "Metro bundler started successfully on port 8081"
    # Setup adb reverse for USB connected devices
    adb reverse tcp:8081 tcp:8081 2>/dev/null || true
    exit 0
  fi
  sleep 0.5
done

echo "Warning: Metro may not have started. Check /tmp/metro.log for errors"
exit 0
