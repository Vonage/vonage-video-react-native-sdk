# Testing in the Vonage Video React Native SDK

## E2E Testing with Detox + jsSDKTesterBot

We use [Detox](https://wix.github.io/Detox/) with a headless Chromium bot ([jsSDKTesterBot](../React-native-TestApp/__tests__/helpers/jsSDKTesterBot.js)) for end-to-end testing. The bot joins the same Vonage Video session as the app under test, enabling real multi-party scenario testing (publish, subscribe, signalling, moderation) without a second device.

### Prerequisites

- **iOS**: `applesimutils` (`brew tap wix/brew && brew install applesimutils`)
- **Android**: `ANDROID_SDK_ROOT` set, emulator created
- **Playwright**: `npx playwright install chromium` (for bot tests)
- **Node.js**: v22+ (see `.nvmrc` in TestApp)

### Credentials

Credentials are generated **automatically** when tests start via Jest's `globalSetup`. No manual pre-generation step is needed.

The `globalSetup` script:
1. Reads `E2E_API_KEY` and `E2E_API_SECRET` from environment variables
2. Creates fresh routed, relayed and moderation sessions via the OpenTok REST API
3. Generates tokens (moderator, publisher, subscriber) with 2h expiry
4. Writes results to `__tests__/.e2e-credentials.json` (gitignored)

**Required environment variables:**

| Variable | Description | Required |
|----------|-------------|----------|
| `E2E_API_KEY` | Vonage Video API key | Yes |
| `E2E_API_SECRET` | Vonage Video API secret | Yes |
| `E2E_API_URL` | API endpoint (default: `https://api.opentok.com`) | No |
| `E2E_JS_SDK_URL` | JS SDK CDN URL (default: `https://static.opentok.com/v2/js/opentok.min.js`) | No |

Alternative variable names (`VONAGE_API_KEY`, `VONAGE_API_SECRET`, `API_URL`) are also supported for CI compatibility.

### Build the App

All commands run from the **root** of the repository:

```sh
# iOS
npm run test:e2e:ios:build

# Android
npm run test:e2e:android:build
```

### Run Tests

```sh
# iOS — all suites
E2E_API_KEY="your_key" E2E_API_SECRET="your_secret" npm run test:e2e:ios

# Android (requires running emulator)
E2E_API_KEY="your_key" E2E_API_SECRET="your_secret" DETOX_AVD_NAME=Pixel_9_API_36 npm run test:e2e:android
```

For dev environments, pass the API URL and JS SDK URL:

```sh
E2E_API_KEY="your_key" \
E2E_API_SECRET="your_secret" \
E2E_API_URL="https://dev.env.com" \
E2E_JS_SDK_URL="https://dev.env/v2/js/opentok.js" \
npm run test:e2e:ios
```

### Run a Specific Suite

```sh
# iOS
E2E_API_KEY=xxx E2E_API_SECRET=xxx npx detox test -c ios.sim.debug -- --testPathPattern "publisher"
E2E_API_KEY=xxx E2E_API_SECRET=xxx npx detox test -c ios.sim.debug -- --testPathPattern "amrTransition"

# Android
E2E_API_KEY=xxx E2E_API_SECRET=xxx DETOX_AVD_NAME=Pixel_9_API_36 npx detox test -c android.emu.debug -- --testPathPattern "subscriber"
```

### Use a Specific Device

```sh
DETOX_DEVICE_NAME="iPhone 15 Pro" E2E_API_KEY=xxx E2E_API_SECRET=xxx npx detox test -c ios.sim.debug
DETOX_AVD_NAME=Pixel_9_API_36 E2E_API_KEY=xxx E2E_API_SECRET=xxx npx detox test -c android.emu.debug
```

### Local Convenience

To avoid typing env vars every time, export them in your shell or create a local file:

```sh
# Add to ~/.zshrc or source before running tests
export E2E_API_KEY="your_key"
export E2E_API_SECRET="your_secret"
export E2E_API_URL="https://api.opentok.com"
export E2E_JS_SDK_URL="https://static.opentok.com/v2/js/opentok.min.js"
```

## Available Test Suites

| Suite | File | Description |
|-------|------|-------------|
| App Launch | `app.e2e.js` | Basic app launch and session connect/disconnect |
| Publish & Subscribe | `publisher.e2e.js` | App publishes → bot receives, bot publishes → app subscribes |
| Subscriber | `subscriber.e2e.js` | Subscriber appears/disappears with bot lifecycle |
| Publisher Options | `publisherOptions.e2e.js` | Mute, camera off, unpublish/republish, audio/video-only |
| Subscriber Options | `subscriberOptions.e2e.js` | Multiple bots, bot disconnect, subscribe audio/video toggles |
| Session Lifecycle | `session.e2e.js` | Connect/disconnect cycles, disconnect while publishing/subscribing, signals |
| Moderation | `moderation.e2e.js` | forceMuteAll, force-disconnect, forceMuteStream via REST, forceUnpublish via a moderator bot |
| Moderation Advanced | `moderationAdvanced.e2e.js` | disableForceMute, connection events, streamCreated payloads |
| AMR Transitions | `amrTransition.e2e.js` | Relayed ↔ routed transitions (2→3→2 participants) |
| P2P | `p2p.e2e.js` | Publish/subscribe in relayed sessions, unpublish/republish, audio/video toggles |
| DTX | `dtx.e2e.js` | Publish/subscribe with DTX enabled and disabled |
| Encryption | `encryption.e2e.js` | E2EE session connect, publish/subscribe, reconnect |
| Screen Sharing | `screenShare.e2e.js` | Toggle screen share on and off, the bot receives each new stream |

## Architecture

### Sessions

`globalSetup.js` creates three sessions once per run and writes their credentials to `.e2e-credentials.json`:

| Session | Factory | Used by |
|---------|---------|---------|
| `routed` | `TestSession.create()` | Most specs |
| `relayed` | `TestSession.createRelayed()` | P2P and other relayed scenarios |
| `moderation` | `TestSession.createModeration()` | `moderation*.e2e.js` only. Includes a moderator token for a bot (`moderatorBotToken`) |

Force mute is **sticky per session**: after `forceMuteAll`, every current and future publisher in that session is muted. That is why moderation specs have their own session and call `resetMuteState(session)` (REST `mute active:false`) in `afterEach`. Never run a spec that mutes a whole session on the shared `routed` session.

### TestSession Helper

All tests use `TestSession`, which encapsulates the session lifecycle:

```javascript
const { launchAndWaitForApp } = require('./helpers/waitForApp');
const { TestSession } = require('./helpers/testSession');

describe('Feature', () => {
  let session;

  beforeAll(async () => {
    await launchAndWaitForApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    session = await TestSession.create();
  });

  afterAll(async () => {
    if (session) await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    if (session) await session.cleanup();  // closes bots, disconnects the app, clears captured events
  });

  it('test case', async () => {
    await session.connectApp();
    const bot = await session.addBot();  // assigns a token, waits for the app to show the subscriber
    // ... assertions ...
  });
});
```

The `if (session)` guards matter: if `beforeAll` fails before the session exists, the hooks must not throw and hide the original error.

**Key `TestSession` methods:**

| Method | Description |
|--------|-------------|
| `TestSession.create()` / `createRelayed()` / `createModeration()` | Session with routed, relayed or moderation credentials |
| `session.credentials` | `apiKey`, `apiSecret`, `apiUrl`, `sessionId`, tokens. Use it for REST calls instead of reading env vars |
| `session.connectApp()` | Connects the app with the right credentials and waits for `sessionConnected` |
| `session.addBot(options?)` | Creates a bot, joins it, and waits for the app's subscriber view. `{ waitForSubscriber: false }` skips the wait, `{ token }` overrides the token |
| `session.addBots(count)` | Adds several bots (only the first waits for the subscriber view) |
| `session.cleanup()` | Closes bots, disconnects the app, clears events. Every step is time-bounded |
| `session.teardown()` | Closes the remaining bots (time-bounded). Call it in `afterAll` |

### App helpers (`helpers/waitForApp.js`)

| Helper | Description |
|--------|-------------|
| `launchAndWaitForApp(params)` | Launches the app (one retry after terminating it), disables Detox synchronization and waits for the UI. Use it in `beforeAll` or `beforeEach` |
| `waitForAppReady(timeout?)` | Polls until the connection form is visible. Called by the helper above |

### jsSDKTesterBot

The bot is a headless Chromium browser (via Playwright) that loads the OpenTok JS SDK and joins the session. It publishes synthetic audio/video (Chromium's `--use-fake-device-for-media-stream` generates color bars + tone). The JS SDK URL is resolved as: `options.jsSdkUrl` → `E2E_JS_SDK_URL` env var → production CDN default.

Inside its page it keeps `window.botSession`, `window.botPublisher` and `window.botState` (`connected`, `publishing`, `subscriberCount`, `streamCreatedCount`, `error`).

| Method | Description |
|--------|-------------|
| `getState()` | Current `window.botState` |
| `getPublisherState()` | `{ hasAudio, hasVideo }` of the bot's own published stream |
| `getPublisherStreamId()` / `getConnectionId()` | IDs for REST calls and payload checks |
| `setPublishAudio(on)` / `setPublishVideo(on)` | Mute or unmute the bot's own microphone/camera |
| `forceUnpublish(streamId)` | Force-unpublish another participant's stream. Needs a moderator token (`session.credentials.moderatorBotToken`) |
| `disconnect()` / `close()` | Leave the session / also close the browser |
| `waitForStream({ streamId?, timeout? })` | Wait for a specific remote stream, or for any subscribed stream |
| `getStreamCount()` + `waitForNewStream(previousCount, timeout?)` | Wait for a stream created *after* an action (see below) |
| `waitForPublisherAudio(expected, timeout?)` | Wait for the bot's published stream to have or lose audio (after a mute) |
| `waitForDisconnected(timeout?)` | Wait for the bot to leave the session (after a force disconnect) |
| `waitForCondition(predicate, arg, label, timeout?)` | Low-level primitive behind the waits above |

All `waitFor*` methods run the check **inside the browser** (`page.waitForFunction`), so they cost no round trip per poll, and they fail with a message that names what was awaited.

### Event Capture

The TestApp has a built-in event capture system for verifying event payloads:

```javascript
const { setCaptureFilter, waitForEvent } = require('./helpers/eventCapture');

// Set up capture BEFORE the event fires
await setCaptureFilter(['streamCreated', 'signal']);

// ... action that triggers the event ...

// Read the captured payload
const event = await waitForEvent('streamCreated');
expect(event.streamId).toBeTruthy();
```

### REST and moderation helpers

- `helpers/openTokRest.js`: `forceDisconnect`, `forceMuteStream`, `disableMuteAll`. Pass values from `session.credentials`. Requests time out after 30 s.
- `helpers/moderation.js`: `openModerationTab()` and `resetMuteState(session)`.

## Adding or extending E2E tests

### Adding a new spec

1. Create `React-native-TestApp/__tests__/<name>.e2e.js` from the skeleton above. The default Jest config picks up `*.e2e.js`.
2. Pick the session factory (`create`, `createRelayed` or `createModeration`).
3. Do not add retries to the spec. The suite allows one retry per test, configured once in `setupRetries.js`: a test that needs more is broken, not flaky.
4. Make the spec self-contained: its own `connectApp()` and its own bots per test. Do not depend on state left by another test or spec. Call `session.cleanup()` in `afterEach` so a retry starts without the bots of the failed attempt.
5. Add the spec to the table in this file.

### Choosing how to wait

| You are waiting for | Use |
|---------------------|-----|
| A UI element in the app | `waitFor(element(by.id('x'))).toBeVisible().withTimeout(ms)` |
| An event delivered to the app | `setCaptureFilter([...])` before the action, then `waitForEvent(type)`; pass a predicate as third argument (`waitForEvent(type, timeout, (e) => e.active === true)`) when an earlier event of the same type can still be the last one captured |
| The bot to see a stream | `bot.waitForStream()` or `bot.waitForStream({ streamId })` |
| A **new** stream after an action (toggle, remount, republish) | `const n = await bot.getStreamCount()`, do the action, `await bot.waitForNewStream(n)`. `subscriberCount` alone cannot tell the old stream from the new one |
| The bot's own stream to change (mute) | `bot.waitForPublisherAudio(false)` |
| The bot to be disconnected | `bot.waitForDisconnected()` |
| A new condition on the bot | Add a method to the bot built on `waitForCondition` |

Avoid fixed sleeps. The only accepted ones are the AMR transitions, which have no observable event (5 s max).

### Writing assertions

- Assert on state that the action changes in **another participant** (the bot's stream `hasAudio`, the bot being disconnected, a captured `connectionDestroyed` payload). Do not assert on counters that the same button handler increments, they pass even when nothing happened.
- Do not swallow failures (`try/catch` with `console.log`) and do not `return` early to skip a test.
- A REST-driven test reads its credentials from `session.credentials`, so it runs wherever the session runs.

### Skipping a test

Use `itIf(condition, reason)` from `helpers/itIf.js`:

```javascript
const { itIf } = require('./helpers/itIf');
const isAndroid = device.getPlatform() === 'android';

itIf(isAndroid, 'feature X is not available on iOS (issue #NNN)')('name', async () => { ... });
```

The test is reported as skipped with the reason in its title, and the CI summary lists it. Always include an issue or ticket reference in the reason.

### Extending the helpers

- **A new bot capability**: add a method to `jsSDKTesterBot.js`. Read what you need from `window.botSession`, `window.botPublisher` or `window.botState` inside `page.evaluate`, and implement waits with `waitForCondition`. Document it in the table above.
- **A new moderation REST call**: add it to `openTokRest.js` using `httpRequest` (it already has the timeout) and take the values from `session.credentials`.
- **A new TestApp control**: add the control with a `testID` in `React-native-TestApp/src/screens/VideoCallScreen.tsx`. Event counters in the UI should only be updated by native events, never by the control that triggers the action.
- **Anything that needs a time bound** in cleanup code: wrap it with `withTimeout(promise, ms, label)` from `helpers/timeout.js`. It continues instead of failing, so use it only for cleanup, never to hide a failed assertion.

## Writing Tests — Key Rules

1. **Always disable Detox synchronization** (`launchAndWaitForApp` does it) — WebRTC timers keep the app permanently "busy"
2. **Never use `await expect(element(...))` directly** — use `waitFor(...).withTimeout()` instead (bare `expect` waits for idle which never comes)
3. **Use `TestSession`** — don't manually manage credentials or bot lifecycle
4. **Use `addBot()` as the synchronization point** — it waits for the subscriber view to appear (proves media is flowing)
5. **Set capture filters BEFORE the action that triggers the event** — otherwise the event fires before capture is active
6. **Use condition-based waits, not sleeps** (see "Choosing how to wait")
7. **Guard `session` in `afterEach`/`afterAll`** and keep cleanup time-bounded
8. **Do not configure retries per spec**: the single retry lives in `setupRetries.js`

## CI

Tests run on every PR via GitHub Actions (`ci-pr-tests.yml`). The `globalSetup` reads credentials from GitHub Secrets (`VONAGE_API_KEY`, `VONAGE_API_SECRET`, `API_URL`), which are passed as environment variables to the test step.

- **iOS** runs as a matrix of two legs, `ios26` (`macos-26-xlarge`, Xcode 26.6) and `ios27` (`xcode-27-xlarge`). Each leg selects a simulator of its iOS major with `scripts/ci-select-ios-simulator.sh <major>` and passes its UUID to Detox through `DETOX_DEVICE_ID`. A leg marked `experimental: true` does not fail the run. To roll the matrix forward, edit only the two `include` entries.
- **Android** runs on an emulator through `scripts/run-android-e2e-in-emulator.sh`.
- Both start Metro with `scripts/ci-start-metro.sh React-native-TestApp`.
- CI uses `npm run test:e2e:ios:ci` (headless). To reproduce a leg locally: `DETOX_DEVICE_ID=<udid> npm run test:e2e:ios:ci`.
- Jest writes `artifacts/jest-results-<platform>.json`. The job summary (`scripts/e2e-results-summary.jq`) lists passed, failed, skipped, **passed after retry** and suites that did not run. A test that passes after a retry is not hidden: it is listed, so repeated entries are the signal to fix that test.

## Resources

- [Detox Documentation](https://wix.github.io/Detox/)
- [Playwright Documentation](https://playwright.dev/)
- [OpenTok JS SDK Reference](https://tokbox.com/developer/sdks/js/reference/)
