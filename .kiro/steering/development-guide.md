# Development Guide

## Prerequisites

- Node.js v20.11.0 (see `.nvmrc`) — use `nvm use` to activate
- Xcode (latest stable) for iOS development
- Android Studio with NDK for Android development
- CocoaPods (`gem install cocoapods`)
- Yarn or npm

## Setup

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

## Common Commands

| Command | Purpose |
|---------|---------|
| `npm test` | Run Jest unit tests |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint across JS/TS files |
| `npm run lint-fix` | Auto-fix lint issues |
| `npm run clean` | Remove build artifacts |
| `npm run prepare` | Generate package info + build with bob |

## Making Changes

### Adding a new method to the TurboModule

1. **Define the spec** in `src/NativeOpentok.ts` — add method signature to the `Spec` interface
2. **Implement on iOS** in `ios/OpentokReactNative.swift` (the actual logic) and `ios/OpentokReactNative.mm` (ObjC++ bridge method)
3. **Implement on Android** in `android/src/main/java/com/opentokreactnative/OpentokReactNativeModule.java`
4. **Expose in JS** if needed, update `src/OT.js` or the relevant component
5. **Update types** in `src/types.ts` (canonical) and optionally `@types/index.d.ts` (legacy compat)
6. **Rebuild codegen**: Clean and rebuild the test app to regenerate native interfaces

### Adding a new prop to a Fabric component

1. **Define in spec** — add prop to `NativeProps` in `src/OTPublisherNativeComponent.ts` or `src/OTSubscriberNativeComponent.ts`
2. **Handle on iOS** in the corresponding `ComponentView.swift` (read from props in `updateProps`)
3. **Handle on Android** in the corresponding `.kt` view file
4. **Sanitize in JS** if needed, update the relevant helper in `src/helpers/`
5. **Rebuild codegen** to get the updated native interface

### Adding a new event from native to JS

For view-scoped events (publisher/subscriber):
1. Add `BubblingEventHandler<EventType>` to the component spec
2. Emit from native view via the component's event emitter

For session-scoped events:
1. Add `EventEmitter<EventType>` to the TurboModule spec
2. Emit from native module on iOS (`self.emitOnXxx(...)`) and Android

## Code Style

- **JS/TS**: Prettier (single quotes, 2-space indent, trailing comma es5). ESLint with `@react-native` config.
- **Swift**: 4-space indent, standard Swift conventions
- **Kotlin**: Standard Kotlin conventions
- **Java**: Standard Android/Java conventions
- **ObjC++**: React Native standard formatting

## Testing

- **Unit tests**: Jest, located in `src/__tests__/`
- Test app: `React-native-TestApp/` — a full RN app for manual and automated testing

## Commit Conventions

Uses [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` new feature
- `fix:` bug fix
- `chore:` maintenance
- `docs:` documentation
- `refactor:` code restructure without behavior change

Enforced via `commitlint` with `@commitlint/config-conventional`.

## Release Process

Managed via `release-it`:
- Bumps version in `package.json`
- Generates changelog from conventional commits
- Creates git tag and GitHub release
- Publishes to npm

## Pull Requests

- Always create PRs as **Draft** (`gh pr create --draft`)
- PRs target `develop` unless explicitly stated otherwise
- Use conventional commit format for PR titles

## Gotchas

- The `@types/index.d.ts` is **legacy**. Canonical types come from `src/types.ts` and generated declarations in `lib/typescript/`.
- Always rebuild codegen after changing specs (`pod install` on iOS, clean Gradle build on Android).
- The OTRN singleton holds strong references — be mindful of cleanup in `disconnect` and `unmount` paths.
- iOS requires the ObjC++ glue layer because Swift can't implement C++ codegen protocols directly.
- Android permissions (camera/mic) are requested at the JS layer before publishing (`checkAndroidPermissions` in `OT.js`).
- The `sessionId` parameter threads through almost every call to support multi-session scenarios.
