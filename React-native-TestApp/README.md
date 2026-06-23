This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Install Dependencies**:

(Recommended version >22 on node)

## Configuration

All credentials and settings are centralized in `sdk-config.json`. Before running the app, update this file with your actual values:

```json
{
  "profiles": {
    "vonage": { ... },
    "opentok": { ... },
    "vonage-github": { ... },
    "opentok-github": { ... },
    "local": { ... }
  },
  "currentProfile": "vonage",
  "credentials": {
    "video": {
      "apiKey": "YOUR_API_KEY",
      "sessionId": "YOUR_SESSION_ID",
      "token": "YOUR_TOKEN"
    },
    "meet": {
      "authHeader": "YOUR_MEET_AUTH_HEADER",
      "baseUrl": "https://meet.tokbox.com"
    },
    "github": {
      "authToken": "YOUR_GITHUB_TOKEN"
    }
  }
}
```

### SDK Profile Configuration

This project supports multiple SDK variants. To switch between them:

1. **Edit `sdk-config.json`** and change the `currentProfile`:
   - `vonage` - npm package @vonage/client-sdk-video-react-native
   - `opentok` - npm package opentok-react-native
   - `vonage-github` - GitHub package @vonage/client-sdk-video-react-native
   - `opentok-github` - GitHub package @opentok/opentok-react-native
   - `local` - local development (file:../)

2. **Update credentials in `sdk-config.json`**:
   - For Video API: Add your `apiKey`, `sessionId`, and `token`
   - For Meet API: Update the `authHeader` if needed
   - For GitHub packages: Add your GitHub personal access token in `credentials.github.authToken`

3. **Run fresh install**:
   ```sh
   npm run fresh-install
   ```

This will:
- Auto-generate `.npmrc` (only for GitHub profiles)
- Switch SDK packages based on the selected profile
- Remove and reinstall all dependencies (node_modules, iOS Pods, etc.)

**Note:** The following files read values from `sdk-config.json`:
- `.npmrc` - Generated only when using `*-github` profiles
- `src/config/credentials.ts` - Reads video credentials from sdk-config.json
- `src/services/meetService.ts` - Reads meet credentials from sdk-config.json

## Build and run your app

### Android

#### Option 1: Using Command Line (Recommended)

```sh
npx react-native run-android --no-packager
```

To manually stop Metro: `lsof -ti:8081 | xargs kill -9`

#### Option 2: Using Android Studio

1. Open the Android project: `open -a "Android Studio" ./android`
2. Wait for Gradle sync to complete
3. Click the Run button

The Gradle build system automatically:
- Starts Metro bundler if not already running
- Sets up ADB reverse for physical devices
- Builds and installs the app

**Note:** Always launch Android Studio from terminal (`open -a "Android Studio" ./android`) to ensure Node.js is in PATH.

### iOS

1. Open the workspace: `open ios/ReactNativeTesApp.xcworkspace`
2. Ensure Camera and Microphone permissions are in Info.plist
3. Verify Signing & Capabilities are configured
4. Select your device/simulator and click Run

Metro will start automatically when building from Xcode.

## Modify your app

The project structure:
```
src/
├── components/     # Reusable React components
├── handlers/       # Event handlers
├── screens/        # Screen components
├── services/       # API and external services
├── styles/         # Style definitions
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

Edit files in `src/` or `App.tsx`. Changes will automatically update thanks to [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

To manually reload:
- **Android**: Press <kbd>R</kbd> twice or <kbd>Cmd ⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>M</kbd> → Reload
- **iOS**: Press <kbd>Cmd ⌘</kbd> + <kbd>R</kbd> in the simulator

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

## Android Studio can't find `npx` during Gradle sync

If you're getting errors about Gradle not being able to find `npx` when syncing the project in Android Studio, Node.js is not in Gradle's PATH.

**Easiest Solution:**

Launch Android Studio from the terminal instead of Finder/Spotlight - it will inherit your shell's PATH automatically:

```sh
open -a "Android Studio" android
```

After Android Studio opens, sync Gradle and the error should be gone.

## General troubleshooting

If you're having other issues getting the above steps to work, see the [React Native Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
