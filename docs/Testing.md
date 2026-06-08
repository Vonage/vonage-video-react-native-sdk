# Testing in the Vonage Video React Native SDK

This document outlines the testing strategies and practices used in the Vonage Video React Native SDK project.

## End-to-End Testing with Detox and Jest

We use Detox with Jest for end-to-end (E2E) testing on iOS simulators and Android emulators. E2E tests verify that the SDK components work correctly within a sample React Native application. While we currently have a minimal setup with basic tests, the infrastructure is in place for comprehensive test coverage.

### Key Files

- **[e2e/app.e2e.js](../e2e/app.e2e.js)** — Main E2E test file containing test suites
- **[e2e/jest.config.json](../e2e/jest.config.json)** — Jest configuration for E2E tests (120s timeout, Detox runner)
- **[detox.config.js](../detox.config.js)** — Detox configuration (app build path, iOS/Android device setup)
- **[e2e/E2ETestingApp/](../e2e/E2ETestingApp/)** — Test application where tests run against

### Test Application

The test app ([e2e/E2ETestingApp/App.tsx](../e2e/E2ETestingApp/App.tsx)) provides a minimal test environment with:

- `OTSession`, `OTPublisher`, and `OTSubscriber` components
- Test IDs (`testID`) for element queries
- Session state management for testing different scenarios

## Getting Started with Testing

### Step 0: Prepare your testing environment

Before running E2E tests, make sure your machine is ready for your target platform:

#### iOS

- Xcode is installed and opened the testing app at least once
- iOS Simulator is installed and available
- The simulator type used in [detox.config.js](../detox.config.js) (currently `iPhone 17`) exists on your machine (or edit the config file to use another simulator you want to use)

Detox relies on `applesimutils` to control iOS simulators. Install it once on macOS before running E2E tests:

```bash
brew tap wix/brew
brew install applesimutils
```

#### Android

- Android Studio is installed
- Android SDK is installed and available in environment variables (`ANDROID_HOME` or `ANDROID_SDK_ROOT`)
- At least one Android emulator (AVD) exists
- Optional: set `DETOX_AVD_NAME` to the AVD name you want Detox to use (default is `Pixel_8_API_36`)

### Step 1: Add Credentials

Add applicable credentials to [e2e/E2ETestingApp/App.tsx](../e2e/E2ETestingApp/App.tsx). In the future, this will be automated; for now, credentials must be added manually. You can generate credentials at the [Vonage Video API Playground](https://tools.vonage.com/video/playground).

### Step 2: Prepare the SDK

In the SDK root:
```bash
npm run prepare
```

In the test app (`e2e/E2ETestingApp` folder):
```bash
npm install  # Install JS dependencies
cd ios && pod install  # Install iOS CocoaPods
```

### Step 3: Build the App

#### iOS

```bash
npm run test:e2e:ios:build
```

This builds the iOS app and Detox framework cache (one-time setup).

#### Android

```bash
npm run test:e2e:android:build
```

This builds both the Android debug APK and Android test APK for Detox.

### Step 4: Run E2E Tests

Make sure metro is running before launching the test run. In the test app foder (`e2e/E2ETestingApp` folder) run:

npm start

Then in a separate terminal, from the root run:

#### iOS

```bash
npm run test:e2e:ios
```

#### Android

```bash
npm run test:e2e:android
```

This launches the selected simulator/emulator, installs the app, and executes all tests in `e2e/**/*.e2e.js`.

## Writing Tests

### Basic Test Structure

```javascript
describe('Feature Name', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should do something', async () => {
    await expect(element(by.text('Expected Text'))).toBeVisible();
  });
});
```

### Common Detox APIs

| API | Purpose |
|-----|---------|
| `element(by.text('...'))` | Find element by text |
| `element(by.id('testID'))` | Find element by testID |
| `expect(...).toBeVisible()` | Assert visibility |
| `await element(...).tap()` | Tap element once |
| `await element(...).multiTap(n)` | Tap element multiple times |
| `await element(...).typeText('...')` | Type into input |
| `device.reloadReactNative()` | Reset app state between tests |

### Adding Test IDs

Make elements queryable by adding `testID` props:

```jsx
<TouchableOpacity testID="start-session-btn">
  <Text>Start Session</Text>
</TouchableOpacity>
```

Then query in tests:

```javascript
await element(by.id('start-session-btn')).multiTap(1);
```

## Testing Best Practices

### Isolation

Use `beforeEach()` to reload the app between tests, ensuring each test runs in a clean state.

### Stability

Add explicit waits for async operations (e.g., session connection) to prevent flaky tests.

### Debugging

Run with the `--record-logs all` flag to capture device logs:

```bash
npm run test:e2e:ios -- --record-logs all
```

### Performance

Tests run serially; keep individual tests focused and quick to maintain reasonable test suite execution times.

## Resources

- [Detox Documentation](https://wix.github.io/Detox/)
- [Jest Matchers](https://jestjs.io/docs/expect)
- [React Native Testing Best Practices](https://reactnative.dev/docs/testing-overview)

