# Repro kit — iOS `muteForced` (issues #300 / #306, PRs #305 / #307)

Everything needed to reproduce, and to verify the fix for, the two defects that together
keep `OTSession`'s `muteForced` handler silent on iOS.

## The two defects

They are independent, and **both** must land before iOS `muteForced` reaches JS:

| | Defect | Fixed by |
|---|---|---|
| native → JS | `ios/OpentokReactNative.swift` declared the delegate as `session(_:info:)` → selector `session:info:`, but `OTSessionDelegate` declares `session:muteForced:`. The protocol method is **optional**, so there is no compiler error — the SDK just never calls it and nothing is emitted. | #307 |
| JS routing | The emitted payload had no top-level `sessionId`, and `OTSession` routes module-global events with `if (event?.sessionId !== sessionId) return;`, so the event is dropped before the handler. | #305 |

Android is only affected by the second one.

## Expected result

`session-forceMute` counter after a remote moderator calls `forceMuteAll`:

| Build | Android | iOS |
|---|---|---|
| `develop` | 0 | 0 |
| `develop` + #305 | **1** | 0 |
| `develop` + #307 | 0 | 0 |
| `develop` + #305 + #307 | **1** | **1** |

## Prerequisites

- Node 22 (`nvm use`), `npm ci` in the repo root and in `React-native-TestApp`
- iOS: full Xcode, `applesimutils` (`brew tap wix/brew && brew install applesimutils`)
- Android: `ANDROID_SDK_ROOT` set, an AVD created
- `npx playwright install chromium` — the moderator client runs in headless Chromium

## Credentials

**Legacy account (API key + secret)** — works with the repo harness as-is:

```bash
export E2E_API_KEY=…  export E2E_API_SECRET=…
```

**Unified account (Application ID + private key)** — `globalSetup.js` cannot mint these.
Generate them yourself with the server SDK and let the harness reuse the file:

```js
// scratch script, outside the repo. npm i @vonage/video @vonage/auth
const { Video, MediaMode } = require('@vonage/video');
const { Auth } = require('@vonage/auth');
const video = new Video(new Auth({ applicationId, privateKey }));
const { sessionId } = await video.createSession({ mediaMode: MediaMode.ROUTED });
const tok = (role) => video.generateClientToken(sessionId, { role });
// write React-native-TestApp/__tests__/.e2e-credentials.json:
// { "routed": { "apiKey": applicationId, "apiUrl": "", "sessionId",
//               "tokenApp": tok('moderator'), "botTokens": [tok('publisher')],
//               "mediaMode": "routed" }, "relayed": { …same shape… } }
```

Then add an early return at the top of `React-native-TestApp/__tests__/globalSetup.js`
so it reuses that file instead of minting (local change, do not commit):

```js
if (process.env.E2E_USE_EXISTING_CREDENTIALS === '1' && fs.existsSync(CREDENTIALS_PATH)) return;
```

> ⚠️ `apiKey` must be the **Application ID** for a unified session, not the numeric API
> key, and `apiUrl` must be empty. The wrong key fails at connect with
> `otk_anvil_on_session_info failed. nCode=1` while the UI still looks connected.
> Never commit `.e2e-credentials.json`, `sdk-config.json` contents, or a private key.

## Build

The codegen spec differs between `develop` and #305, so re-run `pod install` (iOS) or a
clean Gradle build (Android) whenever you switch between the branch combinations above.

```bash
# iOS
npm run prepare                     # lib/ is what Metro resolves, not src/
cd React-native-TestApp/ios && LANG=en_US.UTF-8 pod install && cd ..
xcodebuild -workspace ios/ReactNativeTesApp.xcworkspace -scheme ReactNativeTesApp \
  -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build \
  -destination 'generic/platform=iOS Simulator'

# Android
cd React-native-TestApp/android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug
```

Start Metro (`npm start` in `React-native-TestApp`) before running the suite; for Android
also `adb reverse tcp:8081 tcp:8081`.

## Run

The suite is opt-in, so it never runs in CI:

```bash
# expects the handler TO fire — develop + #305 + #307, or Android + #305
E2E_USE_EXISTING_CREDENTIALS=1 E2E_MUTEFORCED_REPRO=1 \
DETOX_DEVICE_NAME="iPhone 17" \
npx detox test -c ios.sim.debug -- --testPathPattern muteForcedRepro

# expects the handler NOT to fire — any build missing one of the two fixes
E2E_MUTEFORCED_EXPECT=0 …same…

# Android against an already-running emulator
ANDROID_SDK_ROOT=$HOME/Library/Android/sdk E2E_USE_EXISTING_CREDENTIALS=1 \
E2E_MUTEFORCED_REPRO=1 npx detox test -c android.att.debug -- --testPathPattern muteForcedRepro
```

The spec ([`muteForcedRepro.e2e.js`](../React-native-TestApp/__tests__/muteForcedRepro.e2e.js))
connects the app, opens a **connect-only** moderator page in Chromium (no publisher, so it
works on machines where the bot cannot open a fake capture device), calls
`forceMuteAll([])`, and polls the `session-forceMute` counter.

## Reading the result honestly

- **The Disconnect button is not proof of a connection.** `connectedToSession` flips
  optimistically when you tap Connect. Assert `session-sessionConnected: 1` instead — the
  spec does this in `beforeAll`.
- **Never trigger the mute from the in-app Moderation tab.** `sessionMethodForceMuteAll`
  increments `session-forceMute` and `publisher-forceMute` itself right after calling the
  method, so the counter moves even when the callback never fires. That is also why the
  existing `moderation.e2e.js` assertions pass against the broken build. The trigger must
  come from another client.
- **`muteForced` is not delivered to the client that initiates it**, hence the separate
  moderator page.
- Server-side moderation (Video REST `muteAllStreams`) does **not** raise `muteForced` on
  clients — it only changes stream properties. Use a client moderator.

## Narrowing "not emitted" vs "dropped by the guard"

If the handler stays silent, patch the built JS in place — Metro reloads it, no rebuild:

```bash
# in lib/module/OTSession.js, inside OT.onMuteForced(...), delete the line:
#   if (event?.sessionId !== sessionId) return;
```

Re-run. If the counter now moves, the native side emitted and the payload lacked a
matching `sessionId` (the #305 defect). If it still does not move, nothing was emitted at
all (the #306 defect). Restore with `npm run prepare`.

## Traps that cost time

- `detox test` prints nothing useful unless you pass `--loglevel trace`.
- `ANDROID_SDK_ROOT` must be exported for the Detox **run**, not just the Gradle build.
- `DETOX_DEVICE_NAME` must name a simulator that exists (the config default may not).
- On a locked-down Mac the emulator still boots with
  `-gpu swiftshader_indirect -feature -Vulkan`; use `-c android.att.debug` against it so
  Detox does not try to boot its own AVD.
