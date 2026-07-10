# Testing in the Vonage Video React Native SDK

## E2E Testing with Detox + jsSDKTesterBot

We use [Detox](https://wix.github.io/Detox/) with a headless Chromium bot ([jsSDKTesterBot](../React-native-TestApp/__tests__/helpers/jsSDKTesterBot.js)) for end-to-end testing. The bot joins the same Vonage Video session as the app under test, enabling real multi-party scenario testing (publish, subscribe, signalling, moderation) without a second device.

### Prerequisites

- **iOS**: `applesimutils` (`brew tap wix/brew && brew install applesimutils`)
- **Android**: `ANDROID_SDK_ROOT` set, emulator created
- **Playwright**: `npx playwright install chromium` (for bot tests)
- **opentok npm package**: `npm install --no-save opentok` (for credential generation)

### Generate Credentials

Tests need fresh session credentials (tokens expire in 2h):

```sh
export E2E_API_KEY="your_api_key"
export E2E_API_SECRET="your_api_secret"
export E2E_API_URL="https://api.opentok.com"

node scripts/generate-e2e-credentials-local.js
```

This writes `apiKey`, `sessionId`, `token`, `tokenBot`, `tokenBot2`, and `apiUrl` to `React-native-TestApp/sdk-config.json`.

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
npm run test:e2e:ios

# Android (requires running emulator)
DETOX_AVD_NAME=Pixel_9_API_36 npm run test:e2e:android
```

### Run a Specific Suite

```sh
# iOS
npx detox test -c ios.sim.debug -- --testPathPattern "publisher"
npx detox test -c ios.sim.debug -- --testPathPattern "amrTransition"

# Android
DETOX_AVD_NAME=Pixel_9_API_36 npx detox test -c android.emu.debug -- --testPathPattern "subscriber"
```

### Use a Specific Device

```sh
DETOX_DEVICE_NAME="iPhone 15 Pro" npx detox test -c ios.sim.debug
DETOX_AVD_NAME=Pixel_9_API_36 npx detox test -c android.emu.debug
```

### Convenience Script (local development)

```sh
./scripts/run-e2e-local.sh ios              # All tests on iOS
./scripts/run-e2e-local.sh ios publisher    # Specific suite
./scripts/run-e2e-local.sh android          # All tests on Android
./scripts/run-e2e-local.sh ios --build      # Build before running
```

### Test the Bot Independently

```sh
E2E_API_KEY=xxx E2E_API_SECRET=xxx node scripts/test-bot-standalone.js
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
| Moderation | `moderation.e2e.js` | Force-disconnect, forceMuteStream via REST API |
| AMR Transitions | `amrTransition.e2e.js` | Relayed ↔ routed transitions (2→3→2 participants) |
| DTX | `dtx.e2e.js` | Publish/subscribe with DTX enabled and disabled |

## How the Bot Works

The `jsSDKTesterBot` is a headless Chromium browser (via Playwright) that loads the OpenTok JS SDK and joins the same Vonage Video session as the app under test. It publishes synthetic audio/video (Chromium's `--use-fake-device-for-media-stream` flag generates color bars + tone). Multiple bot instances can run simultaneously for multi-party tests.

The JS SDK URL is configurable via `E2E_JS_SDK_URL` env var. Default: `https://static.opentok.com/v2/js/opentok.min.js`.

## CI

Tests run automatically on every PR via GitHub Actions (`ci-pr-tests.yml`). Credentials are generated from GitHub Secrets (`VONAGE_API_KEY`, `VONAGE_API_SECRET`, `API_URL`). Playwright Chromium is installed and cached.

## Writing Tests

### Pattern

All test suites follow this pattern:

```javascript
describe('Feature', () => {
  beforeAll(async () => {
    credentials = await getCredentials();
    await device.launchApp({ newInstance: true, permissions: { camera: 'YES', microphone: 'YES' } });
    await device.disableSynchronization();
    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();
  });

  afterAll(async () => {
    await device.terminateApp();
    if (bot) await bot.close();
  });

  it('test case', async () => {
    // Connect, interact, assert
  });
});
```

### Key Points

- Use `device.disableSynchronization()` — the SDK keeps native threads busy
- Use `setTimeout` waits instead of `waitFor` — Detox idle detection conflicts with WebRTC
- Use `toExist()` instead of `toBeVisible()` for native video views on Android
- Use `waitForAppReady()` helper for reliable app initialization
- Call `device.terminateApp()` in `afterAll` to disconnect the session cleanly

## Resources

- [Detox Documentation](https://wix.github.io/Detox/)
- [Playwright Documentation](https://playwright.dev/)
- [OpenTok JS SDK Reference](https://tokbox.com/developer/sdks/js/reference/)
