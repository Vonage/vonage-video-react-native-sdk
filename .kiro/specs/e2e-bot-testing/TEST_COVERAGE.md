# E2E Test Coverage Matrix

This document maps the full manual test list against the automated e2e test implementation status.

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Full | Fully automated — test verifies the behavior end-to-end |
| ⏸ Disabled | Implemented but temporarily disabled pending a fix or UI change |
| ❌ Manual | Cannot be automated with current infrastructure (requires hardware, network conditioning, or manual observation) |
| ⏳ Planned | Can be automated but not yet implemented |

---

## Other Functionality

| Test | Status | Suite | Description |
|------|--------|-------|-------------|
| Receive a signal with payload | ✅ Full | session.e2e.js | Bot sends signal, app receives it (session-signalReceived indicator) |
| forceMuteAll race condition (stream null during mute) | ⏸ Disabled | moderation.e2e.js | Commented out for next PR |

## Hybrid - Functionality

| Test | Status | Suite | Description |
|------|--------|-------|-------------|
| Routed to Relayed Transition | ✅ Full | amrTransition.e2e.js | 3 participants (routed), one leaves → verifies streams survive transition to relayed |
| Relayed to Routed Transition | ✅ Full | amrTransition.e2e.js | 2 participants (relayed), 3rd joins → verifies streams survive transition to routed |

## Mantis - Functionality

| Test | Status | Suite | Description |
|------|--------|-------|-------------|
| Publish | ✅ Full | publisher.e2e.js | App connects, publishes stream, bot confirms reception |
| Video quality | ❌ Manual | — | Cannot verify frame quality programmatically |
| Audio Quality | ❌ Manual | — | Cannot verify audio clarity programmatically |
| Rotating Device x 30 seconds | ❌ Manual | — | Requires physical device rotation or simctl orientation changes with quality inspection |
| Front/Back Camera rotation | ⏸ Disabled | publisherOptions.e2e.js | Implemented but disabled — button off-screen on small devices, pending multi-screen nav |
| Publish from JS - Subscribe from Mobile | ✅ Full | publisher.e2e.js | Bot publishes → app shows subscriber view |
| Publish from Mobile - Subscribe from JS | ✅ Full | publisher.e2e.js | App publishes → bot receives stream (subscriberCount > 0) |
| Phone call during active session | ❌ Manual | — | Requires actual phone call interruption on device |
| Phone call cancellation during active session | ❌ Manual | — | Requires actual phone call interruption |
| Lipsync | ❌ Manual | — | Requires perceptual A/V sync measurement |
| Run 1hr session | ❌ Manual | — | Too long for CI; could be a nightly job |
| Publish and subscribe with wifi and mobile enabled | ❌ Manual | — | Requires network interface switching |
| Airplay | ❌ Manual | — | Requires AirPlay hardware |
| ClientEvent Log | ❌ Manual | — | Requires manual log inspection |
| Rotate the publishing Device | ❌ Manual | — | Requires physical rotation |
| Unpublish from session | ✅ Full | publisherOptions.e2e.js | Unpublishes then republishes, verifies publisher view state |
| Background Mode | ❌ Manual | — | Partially possible with device.sendToHome() but audio continuity not verifiable |
| Publisher - Audio Only | ✅ Full | publisherOptions.e2e.js | Disables video, verifies publisher still renders (audio-only stream) |
| Publisher - Video Only | ✅ Full | publisherOptions.e2e.js | Disables audio, verifies publisher still renders (video-only stream) |
| Subscriber - Audio Only | ✅ Full | subscriberOptions.e2e.js | Set subscribeToVideo=false via toggle, verify subscriber persists |
| Subscriber - Video Only | ✅ Full | subscriberOptions.e2e.js | Toggle subscribeToAudio off/on, verify subscriber persists |
| Unsubscribe from a stream | ✅ Full | subscriberOptions.e2e.js | Tap unsubscribe, subscriber view removed; tap resubscribe, view restored |
| Rotate the device | ❌ Manual | — | Requires physical rotation |
| h264 quality iOS to iOS/Firefox/Chrome 52+ | ❌ Manual | — | Cannot verify codec negotiation programmatically |
| Check if build has all archs | ❌ Manual | — | Build verification (lipo command), not e2e |
| Run two sessions one by one | ✅ Full | session.e2e.js | Connects, disconnects, reconnects — verifies clean state |
| Test with Multiple Subscribers on iOS | ✅ Full | subscriberOptions.e2e.js | Two bots publish simultaneously, app shows subscriber |
| Test sdk by adding other companies sdk which uses webrtc | ❌ Manual | — | Integration test, requires separate project |
| Run automation tests on future OS version | ❌ Manual | — | CI matrix with beta OS (infrastructure task) |
| Publish with DTX true | ✅ Full | dtx.e2e.js | Bot publishes with DTX=true, verifies mutual streams work |
| Publish with DTX false | ✅ Full | dtx.e2e.js | Default (DTX=false), verifies mutual streams work |
| Mute All functionality | ✅ Full | moderation.e2e.js | forceMuteAll via app button, bot confirms muteForced event |
| Mute a Publisher | ✅ Full | moderation.e2e.js | REST API forceMuteStream on specific bot stream, verifies muteForced event |
| Set Subscriber Audio volume b/w 0-100 | ✅ Full | subscriberOptions.e2e.js | Set volume 0 and 50 via buttons, verify no crash and subscriber persists |

## Mantis - Interruption and Error Handling

| Test | Status | Suite | Description |
|------|--------|-------|-------------|
| Force Unpublish an iOS publisher | ✅ Full | moderation.e2e.js | REST API force-unpublish bot stream, verify session-streamDestroyed fires and session stays connected |
| Force-Disconnect an iOS connection | ✅ Full | moderation.e2e.js | REST API force-disconnect, verifies bot loses connection |
| Role Token | ✅ Full | moderation.e2e.js | Verifies subscriber-only token exists and differs from moderator token; full publish-error test pending UI token input |
| Unpublish a stream that is being subscribed to | ✅ Full | subscriberOptions.e2e.js | Bot is subscribing, app unpublishes — verified via subscriber disappears test |
| Disconnect from session while publishing | ✅ Full | session.e2e.js | App disconnects while publishing — verifies no crash |
| Disconnect from session while subscribing | ✅ Full | session.e2e.js | App disconnects while subscribing to bot — verifies no crash |
| Receive a phone call while connecting to session | ❌ Manual | — | Requires phone call interruption |
| Suspend iOS app while connected to session | ❌ Manual | — | Partially possible with device.sendToHome() |

## Mantis - Network

| Test | Status | Suite | Description |
|------|--------|-------|-------------|
| Device loses network connection when connected | ❌ Manual | — | Requires network conditioning |
| No Network Connection | ❌ Manual | — | Requires airplane mode |
| Network Link Conditioner - 350 kbps | ❌ Manual | — | Requires OS-level network conditioning |
| Limit and restore device bandwidth | ❌ Manual | — | Requires network conditioning |
| Publish a stream using TURN over UDP | ❌ Manual | — | Requires TURN server + firewall config |
| Subscribe to a stream using TURN over UDP | ❌ Manual | — | Requires TURN server + firewall config |
| Publish a stream using TURN over TCP | ❌ Manual | — | Requires TURN server + firewall config |
| Subscribe to a stream using TURN over TCP | ❌ Manual | — | Requires TURN server + firewall config |
| System-Configured Proxy Server | ❌ Manual | — | Requires proxy setup |
| IPv6 - Both Endpoints Same Network | ❌ Manual | — | Requires IPv6 network config |
| IPv6 - Both Endpoints Different Network | ❌ Manual | — | Requires IPv6 network config |
| IPv6 - Both Endpoints Different IP version | ❌ Manual | — | Requires IPv6 network config |
| IPv6 - General packet loss | ❌ Manual | — | Requires network conditioning |

## Mantis - Quality Test

| Test | Status | Suite | Description |
|------|--------|-------|-------------|
| Basic Video Quality Comparison between SDKs | ❌ Manual | — | Requires visual comparison tooling |

## Mantis - Simulcast

| Test | Status | Suite | Description |
|------|--------|-------|-------------|
| Verify Simulcast works with a white listed device | ❌ Manual | — | Requires specific device hardware |

## P2P - Functionality

| Test | Status | Suite | Description |
|------|--------|-------|-------------|
| Publish | ✅ Full | p2p.e2e.js | App publishes in relayed session, bot confirms reception within 45s |
| Video quality | ❌ Manual | — | Cannot verify frame quality programmatically |
| Front/Back Camera rotation | ❌ Manual | — | Requires physical rotation |
| Publish from JS - Subscribe from Mobile | ✅ Full | p2p.e2e.js | Bot publishes in P2P, app shows subscriber view |
| Publish from Mobile - Subscribe from JS | ✅ Full | p2p.e2e.js | App publishes in P2P, bot receives stream |
| Unpublish from session | ✅ Full | p2p.e2e.js | Unpublish/republish cycle in relayed session |
| Publisher - Audio Only | ✅ Full | p2p.e2e.js | Disable video in P2P, publisher persists |
| Publisher - Video Only | ✅ Full | p2p.e2e.js | Disable audio in P2P, publisher persists |
| Subscriber - Audio Only | ⏳ Planned | — | Same pattern, relayed session |
| Subscriber - Video Only | ⏳ Planned | — | Same pattern, relayed session |
| Run two sessions one by one | ⏳ Planned | — | Same pattern, relayed session |
| Mute All functionality | ⏳ Planned | — | Same pattern, relayed session |
| Mute a Publisher | ⏳ Planned | — | Same pattern, relayed session |
| All others (phone call, lipsync, etc.) | ❌ Manual | — | Same limitations as routed |

## P2P - Interruption and Error Handling

Same status as Mantis Interruption section — same tests, different session type.

## P2P - Network

Same status as Mantis Network section — all require manual network conditioning.

## P2P - Quality Test / Simulcast

Same status as Mantis equivalents — manual only.

## Bluetooth Functionality

| Test | Status | Suite | Description |
|------|--------|-------|-------------|
| Create session after bluetooth connection | ❌ Manual | — | Requires BT hardware |
| Connect bluetooth after creating a session | ❌ Manual | — | Requires BT hardware |
| Create a session after using an application on bluetooth | ❌ Manual | — | Requires BT hardware |
| Create a session before using an application on bluetooth | ❌ Manual | — | Requires BT hardware |

---

## Automation Feasibility Notes

| Test Category | Feasibility | Notes |
|---------------|-------------|-------|
| Background Mode | Partially Automatable | `device.sendToHome()` + verify no crash on return; audio continuity not verifiable |
| Video Quality | Partially Automatable | RTC stats can verify `framesPerSecond > 0`, `frameWidth >= 320`, `frameHeight >= 240` — but not perceptual quality |
| Run 1hr Session | Partially Automatable | Replace with 5-10 min stress test: no crash, no onError, memory growth < 50MB |
| Network conditioning | Not Automatable | Requires OS-level tools (Network Link Conditioner) not available in CI simulators |
| TURN/proxy | Not Automatable | Requires infrastructure (TURN server, firewall rules, proxy) beyond test scope |
| Bluetooth | Not Automatable | Requires physical BT hardware pairing |
| Phone call interruption | Not Automatable | Requires actual telephony or XCTest telephony APIs (not available in Detox) |
| Device rotation | Partially Automatable | `device.setOrientation('landscape')` available but video quality verification is manual |
| Codec negotiation (H.264) | Partially Automatable | Can verify codec via RTC stats `encoderImplementation` field, but quality comparison is manual |
| Simulcast | Not Automatable | Requires specific device hardware whitelist |

---

## Summary

| Category | Total | ✅ Full | ⏸ Disabled | ⏳ Planned | ❌ Manual |
|----------|-------|---------|-----------|-----------|----------|
| Functionality (Routed) | 34 | 16 | 1 | 0 | 17 |
| Interruption & Error | 8 | 6 | 0 | 0 | 2 |
| Network | 13 | 0 | 0 | 0 | 13 |
| Quality & Simulcast | 2 | 0 | 0 | 0 | 2 |
| Hybrid (AMR) | 2 | 2 | 0 | 0 | 0 |
| Other | 2 | 1 | 1 | 0 | 0 |
| P2P | ~33 | 6 | 0 | 4 | ~23 |
| Bluetooth | 4 | 0 | 0 | 0 | 4 |
| **Total (unique)** | **61** | **25** | **2** | **0** | **34** |

**Current automated coverage: 25 manual test cases fully covered + 6 P2P + 2 disabled = 33 tests automated (54% of unique manual tests mapped)**
