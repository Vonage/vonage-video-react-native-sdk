# Subscriber teardown regression checks

Run `JAVA_HOME=/path/to/jdk-17 bash android/__tests__/subscriber-cleanup/run.sh`
from the repository root. The Android CI job runs this before building the app.

The checks compile the production `SubscriberCleanup.java` with small SDK/state
doubles. They cover native-view cleanup before queued JS cleanup, the opposite
ordering, a replacement subscriber on another session, repeated cleanup, and
missing/detached subscribers. The `destroy()` double deliberately does nothing,
matching the linked Android SDK, so it cannot mask missing unsubscribe calls.

These checks verify lifecycle logic. The Android build verifies the helper and
both callers against the real SDK; live-session tests are still needed to verify
rendering, media behavior, and physical-device resource use.
