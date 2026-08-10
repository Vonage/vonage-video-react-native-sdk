# Video React Native SDK

<img src="https://assets.tokbox.com/img/vonage/Vonage_VideoAPI_black.svg" height="48px" alt="Tokbox is now known as Vonage" />

React Native library for [Vonage Video API](https://developer.vonage.com/en/video/overview) / [OpenTok](https://tokbox.com/developer/). This library is officially supported by Vonage.

---

## 📦 Unified Monorepo - Two Packages

This repository represents the **consolidated monorepo** that produces both:
- **`@vonage/client-sdk-video-react-native`** - Vonage-branded package
- **`opentok-react-native`** - OpenTok-branded package

We merged previously separate branding-specific repositories into this single codebase to eliminate duplication and streamline maintenance. Bug fixes and features are now automatically available to both packages from a single source of truth.

---

## Quick Start

### Installation

Choose the package that matches your preference:

**Vonage Package:**
```bash
npm install @vonage/client-sdk-video-react-native@<VERSION>
```

**OpenTok Package:**
```bash
npm install opentok-react-native@<VERSION>
```

**Note:** Replace `<VERSION>` with the target version to use.

### Basic Usage

The packages are functionally identical. The only difference is their session prop names:

**Vonage Package:**
```jsx
<OTSession applicationId="your-application-id" sessionId="your-session-id" token="your-session-token">
  <OTPublisher style={{ width: 100, height: 100 }}/>
  <OTSubscriber style={{ width: 100, height: 100 }} />
</OTSession>
```

**OpenTok Package:**
```jsx
<OTSession apiKey="your-api-key" sessionId="your-session-id" token="your-session-token">
  <OTPublisher style={{ width: 100, height: 100 }}/>
  <OTSubscriber style={{ width: 100, height: 100 }} />
</OTSession>
```

### Camera Preview / Waiting Room

Use the `previewOnly` prop on `OTPublisher` to render the local camera
without publishing into the session — the building block for a
waiting-room / lobby experience. Set it to `false` when the user joins: the
same publisher is published without restarting the camera.

```jsx
<OTSession applicationId="your-application-id" sessionId="your-session-id" token="your-session-token">
  <OTPublisher previewOnly={!hasJoined} style={{ width: 100, height: 100 }}/>
</OTSession>
```

An `OTPublisher` with `previewOnly` also works outside of an `OTSession`, for
a pre-call preview before any session or credentials exist:

```jsx
<OTPublisher previewOnly style={{ width: 100, height: 100 }}/>
```

Keep `publishVideo: true` while previewing — setting it to `false` stops the
camera capturer (that is the "camera off" toggle in a lobby UI). The native
SDKs only start audio capture when publishing begins, so `audioLevel` events
are not emitted during preview; they start once the publisher is published.
See `React-native-TestApp/src/screens/WaitingRoomScreen.tsx` for a complete
example. Switching a published publisher back to `previewOnly` is not
supported.

---

## Important: React Native New Architecture Support

**Starting from version 2.31.1**, this SDK is built with the [React Native new architecture](https://reactnative.dev/architecture/landing-page).

- ✅ **Supported:** React Native 0.81+ (new architecture)
- ❌ **Not supported:** Older React Native versions (legacy architecture)

Applications using older SDK versions will need to migrate to React Native's new architecture before upgrading.

---

## Documentation & Resources

### Vonage Package

| Resource | Link |
|----------|------|
| **SDK Documentation** | [https://developer.vonage.com/en/video/client-sdks/react-native/overview](https://developer.vonage.com/en/video/client-sdks/react-native/overview) |
| **API Reference** | [https://vonage.github.io/video-docs/video-react-native-reference/latest](https://vonage.github.io/video-docs/video-react-native-reference/latest) |
| **Sample Applications** | [vonage-video-react-native-sdk-samples](https://github.com/Vonage/vonage-video-react-native-sdk-samples) |
| **Release Notes** | [https://developer.vonage.com/en/video/client-sdks/react-native/release-notes](https://developer.vonage.com/en/video/client-sdks/react-native/release-notes) |
| **Developer Guides** | [https://developer.vonage.com/en/video/overview](https://developer.vonage.com/en/video/overview) |

### OpenTok Package

| Resource | Link |
|----------|------|
| **SDK Documentation** | [https://tokbox.com/developer/sdks/react-native/](https://tokbox.com/developer/sdks/react-native/) |
| **API Reference** | [https://tokbox.com/developer/sdks/react-native/reference](https://tokbox.com/developer/sdks/react-native/reference) |
| **Sample Applications** | [opentok-react-native-samples](https://github.com/opentok/opentok-react-native-samples) |
| **Release Notes** | [https://tokbox.com/developer/sdks/react-native/release-notes](https://tokbox.com/developer/sdks/react-native/release-notes) |
| **Developer Guides** | [https://tokbox.com/developer/guides](https://tokbox.com/developer/guides) |

---

## Samples

Sample applications are available for both packages:

- **Vonage:** [vonage-video-react-native-sdk-samples](https://github.com/Vonage/vonage-video-react-native-sdk-samples)
- **OpenTok:** [opentok-react-native-samples](https://github.com/opentok/opentok-react-native-samples)

Both repos include:

- **Basic Video Chat** - Connect, publish, and subscribe to streams
- **Archiving** - Display recording indicators
- **Background Blur** - Apply video transformers
- **Multiparty** - Manage multiple participants
- **Signaling** - Send and receive text signals
- **Screen Sharing** - Publish screen-sharing streams

---

## Development and Contributing

Interested in contributing? We :heart: pull requests! See the [Contribution guidelines](CONTRIBUTING.md).

---

## Getting Help

We love to hear from you! If you have questions, comments, or find a bug in the project, let us know:

- **Open an issue** on this repository
- **Vonage Support:** [https://api.support.vonage.com/hc/en-us/](https://api.support.vonage.com/hc/en-us/)
- **OpenTok Support:** [https://support.tokbox.com/](https://support.tokbox.com/)
- **Tweet at us:** [@VonageDev](https://twitter.com/VonageDev)
- **Join the community:** [Vonage Developer Community Slack](https://developer.nexmo.com/community/slack)

---

## License

This project is licensed under the Adobe-2 License. See the [LICENSE](LICENSE) file for details.
