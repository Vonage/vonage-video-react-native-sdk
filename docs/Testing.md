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
2. Creates fresh routed + relayed sessions via the OpenTok REST API
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
| Moderation | `moderation.e2e.js` | forceMuteAll, force-disconnect, forceMuteStream via REST |
| Moderation Advanced | `moderationAdvanced.e2e.js` | forceUnpublish, connection events, streamCreated payloads |
| AMR Transitions | `amrTransition.e2e.js` | Relayed ↔ routed transitions (2→3→2 participants) |
| P2P | `p2p.e2e.js` | Publish/subscribe in relayed sessions, unpublish/republish, audio/video toggles |
| DTX | `dtx.e2e.js` | Publish/subscribe with DTX enabled and disabled |
| Encryption | `encryption.e2e.js` | E2EE session connect, publish/subscribe, reconnect |

## Architecture

### TestSession Helper

All tests use `TestSession` — a helper that encapsulates session lifecycle:

```javascript
const { TestSession } = require('./helpers/testSession');

describe('Feature', () => {
  let session;

  beforeAll(async () => {
    await device.launchApp({ newInstance: true, permissions: { camera: 'YES', microphone: 'YES' } });
    await device.disableSynchronization();
    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();

    session = await TestSession.create();          // routed session
    // or: session = await TestSession.createRelayed();  // P2P session
  });

  afterAll(async () => {
    await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    await session.cleanup();  // disconnects bots + app, clears events
  });

  it('test case', async () => {
    await session.connectApp();
    const bot = await session.addBot();  // auto-assigns token, waits for subscriber
    // ... assertions ...
  });
});
```

**Key `TestSession` methods:**

| Method | Description |
|--------|-------------|
| `TestSession.create()` | Creates session with routed credentials |
| `TestSession.createRelayed()` | Creates session with relayed (P2P) credentials |
| `session.connectApp()` | Connects app with correct credentials, waits for sessionConnected |
| `session.addBot(options?)` | Creates bot, joins session, waits for subscriber view (default) |
| `session.addBot({ waitForSubscriber: false })` | Joins bot without waiting for subscriber |
| `session.cleanup()` | Disconnects all bots + app, clears event capture |
| `session.teardown()` | Closes all browser instances |

### jsSDKTesterBot

The bot is a headless Chromium browser (via Playwright) that loads the OpenTok JS SDK and joins the session. It publishes synthetic audio/video (Chromium's `--use-fake-device-for-media-stream` generates color bars + tone).

The JS SDK URL is resolved as: `options.jsSdkUrl` → `E2E_JS_SDK_URL` env var → production CDN default.

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

## Writing Tests — Key Rules

1. **Always use `device.disableSynchronization()`** — WebRTC timers keep the app permanently "busy"
2. **Never use `await expect(element(...))` directly** — use `waitFor(...).withTimeout()` instead (bare `expect` waits for idle which never comes)
3. **Use `TestSession`** — don't manually manage credentials or bot lifecycle
4. **Use `addBot()` as the synchronization point** — it waits for the subscriber view to appear (proves media is flowing)
5. **Set capture filters BEFORE the action that triggers the event** — otherwise the event fires before capture is active
6. **Use event-based waits, not sleeps** — `waitFor(element).toExist().withTimeout()` instead of `setTimeout`
7. **Only use fixed sleeps for AMR transitions** — these have no observable event, use 5s max

## CI

Tests run automatically on every PR via GitHub Actions (`ci-pr-tests.yml`). The `globalSetup` reads credentials from GitHub Secrets (`VONAGE_API_KEY`, `VONAGE_API_SECRET`, `API_URL`) which are passed as environment variables to the test execution step.

## Resources

- [Detox Documentation](https://wix.github.io/Detox/)
- [Playwright Documentation](https://playwright.dev/)
- [OpenTok JS SDK Reference](https://tokbox.com/developer/sdks/js/reference/)
