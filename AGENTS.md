# Video React Native SDK

## Project Overview

`@vonage/client-sdk-video-react-native` is the official React Native SDK for the Vonage Video API (OpenTok). It provides React Native components (`OTSession`, `OTPublisher`, `OTSubscriber`) that wrap the native Vonage Video SDKs for iOS and Android, enabling real-time video communication in React Native applications.

This is a **unified monorepo** that produces two npm packages from a single codebase:
- `@vonage/client-sdk-video-react-native` (Vonage-branded)
- `opentok-react-native` (OpenTok-branded)

The SDK uses exclusively the React Native **New Architecture** (TurboModules + Fabric) and requires React Native 0.81+.

## Tech Stack

- **Languages:** TypeScript, JavaScript, Swift, Objective-C++, Kotlin, Java
- **Framework:** React Native (New Architecture — TurboModules + Fabric)
- **Build system:** react-native-builder-bob (JS), CocoaPods (iOS), Gradle (Android)
- **Test frameworks:** Jest (unit), Detox (E2E), Playwright (bot for E2E)
- **Release tooling:** release-it, conventional-changelog
- **Linting:** ESLint with `@react-native` config, Prettier
- **Native SDK dependency:** VonageClientSDKVideo v2.34.0 (iOS CocoaPod, Android Maven)
- **Node version:** v22.11.0 (see `.nvmrc`)

## Architecture

```
src/                         # JS/TS layer — codegen specs, React components, types
├── NativeOpentok.ts         # TurboModule spec (session operations + events)
├── OTPublisherNativeComponent.ts  # Fabric publisher view spec
├── OTSubscriberNativeComponent.ts # Fabric subscriber view spec
├── OTSession.js             # Session component (init, connect, event dispatch)
├── OTPublisher.js           # Publisher component (permissions, publish lifecycle)
├── OTSubscriber.js          # Subscriber component (stream management)
├── OT.js                    # Native module re-export + Android permission helper
├── types.ts                 # Canonical TypeScript type definitions
├── helpers/                 # Property sanitizers, session state helpers
├── contexts/                # React Context for sessionId sharing
└── __tests__/               # Jest unit tests

ios/                         # iOS native implementation
├── OpentokReactNative.mm    # ObjC++ TurboModule glue (codegen conformance)
├── OpentokReactNative.swift # Swift session method implementation
├── OTRN.swift               # Shared state singleton
├── OTRNPublisherComponentView.swift  # Fabric publisher view
├── OTRNSubscriberComponentView.swift # Fabric subscriber view
└── Utils/                   # Property sanitization, type conversion

android/src/main/java/com/opentokreactnative/
├── OpentokReactNativeModule.java  # TurboModule implementation
├── OTRN.java                      # Shared state singleton
├── OTRNPublisher.kt               # Fabric publisher view
├── OTRNSubscriber.kt              # Fabric subscriber view
└── utils/                         # Property conversion, event helpers

React-native-TestApp/        # Full RN app for manual and E2E testing
```

**Key design patterns:**
- All state keyed by `sessionId` for multi-session support
- TurboModule handles session-level operations; Fabric components handle view rendering
- ObjC++ glue layer bridges codegen C++ to Swift (Swift cannot implement C++ protocols directly)
- React Context pattern for sharing sessionId from `OTSession` to child components

## Development Workflow

### Branch naming
Branch names must match Jira ticket IDs (e.g., `VIDCS-4050`).

### Pull requests
- Always create PRs as **Draft** (`gh pr create --draft`)
- PRs target `develop` unless explicitly stated otherwise

### Commit messages
This repo uses **Conventional Commits** format enforced via `commitlint`:
- `feat:` new feature
- `fix:` bug fix
- `chore:` maintenance
- `docs:` documentation
- `refactor:` code restructure without behavior change

**Note:** The standard VIDCS ticket-prefix format (`VIDCS-XXXX Description`) is NOT used in this repository due to a commit-msg hook that enforces conventional commits.

### Setup

```bash
nvm use
npm install
```

For the test app:
```bash
cd React-native-TestApp
npm install
cd ios && pod install && cd ..
```

### Common commands

| Command | Purpose |
|---------|---------|
| `npm test` | Run Jest unit tests |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint across JS/TS files |
| `npm run lint-fix` | Auto-fix lint issues |
| `npm run clean` | Remove build artifacts |
| `npm run prepare` | Generate package info + build with bob |

## Testing

### Unit tests
- Framework: Jest
- Location: `src/__tests__/`
- Run: `npm test` or `npm run test:unit`

### E2E tests
- Framework: Detox (iOS and Android)
- Bot: Playwright (Chromium) for simulating a remote participant
- Location: `React-native-TestApp/e2e/`

**iOS:**
```bash
npm run test:e2e:ios:build
npm run test:e2e:ios
```

**Android:**
```bash
npm run test:e2e:android:build
npm run test:e2e:android
```

**Install E2E bot:** `npm run test:e2e:install-bot`

### Testing with sample apps
Use `npm pack` to create a local tarball, then install it in sample apps:
- [vonage-video-react-native-sdk-samples](https://github.com/Vonage/vonage-video-react-native-sdk-samples)
- [opentok-react-native-samples](https://github.com/opentok/opentok-react-native-samples)

## AI Guidance

### Code style
- **JS/TS:** Prettier (single quotes, 2-space indent, trailing comma es5). ESLint with `@react-native` config.
- **Swift:** 4-space indent, standard Swift conventions
- **Kotlin:** Standard Kotlin conventions
- **Java:** Standard Android/Java conventions
- **ObjC++:** React Native standard formatting

### Adding new functionality
- **New TurboModule method:** Define spec in `src/NativeOpentok.ts` → implement iOS (`.swift` + `.mm`) → implement Android (`.java`) → expose in `OT.js` → update `types.ts`
- **New Fabric prop:** Define in component spec → handle in `ComponentView.swift` (iOS) → handle in `.kt` (Android) → rebuild codegen
- **New event:** Add `BubblingEventHandler` (view-scoped) or `EventEmitter` (session-scoped) to spec → emit from native

### Important constraints
- Always rebuild codegen after changing specs (`pod install` iOS, clean Gradle Android)
- `@types/index.d.ts` is **legacy** — canonical types live in `src/types.ts`
- The OTRN singleton holds strong references; be careful with cleanup in disconnect/unmount
- iOS requires ObjC++ glue because Swift cannot implement C++ codegen protocols
- Android permissions (camera/mic) are requested at the JS layer before publishing
- The `sessionId` parameter threads through all calls for multi-session support
- Never commit secrets (tokens, session IDs) — see `React-native-TestApp/sdk-config.json`
- Never commit internal dev environment URLs (*.dev.opentok.com, *.dev.tokbox.com)
- All documentation, comments, and commit messages must be in English

## Vonage AI Tooling

### vgai (AI Attribution)

This repository uses `vgai` (vonage-git-ai) for tracking AI adoption in commits. All commits must include accurate AI attribution metadata.

- **After each commit**, verify the AI attribution report is correct by checking git notes on the commit
- If the reported percentage seems inaccurate, **inform the user** and let them decide whether to run `vgai override <percentage>` to correct it — do not override automatically
- Thresholds for PR labels: >90% → `ai-generated`, 20-90% → `ai-assisted`, <20% → `no-ai`
- Install hooks for automatic tracking: `vgai install-kiro-ide-hooks` (for Kiro IDE)
- The attribution is stored as git notes (`refs/notes/ai`) following Git AI Standard v3.0.0

### vg-ai (Environment Manager)

Use `vg-ai` to manage AI development tooling:
- Install skills: `vg-ai skills install <skill-name>`
- Install MCP servers: `vg-ai mcp install <server-name>`
- Install agents: `vg-ai agent install <agent-name>`
- Check environment health: `vg-ai doctor`
- Update everything: `vg-ai update`

### Jira Integration (Optional)

This project supports Jira MCP integration for ticket context during development sessions. To enable:
1. Set the environment variable: `export JIRA_PERSONAL_TOKEN=<your-token>`
2. The Jira MCP server is configured globally and provides access to issue details, search, transitions, and more
3. When working on a ticket, reference it by key (e.g., `VIDCS-XXXX`) to pull context into your session
