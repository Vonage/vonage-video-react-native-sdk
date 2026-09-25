# VIDCS-4941 backport status: 2.35.0 vs. 2.34.1 / 2.33.4

This tracks every behavioral fix introduced between `v2.34.0` and `v2.35.0`
(the release that closed VIDCS-4941) and whether each one has been ported to
the two patch backport branches:

- **2.34.1** = `fix/VIDCS-4941-2.34.1-backport`
- **2.33.4** = `fix/VIDCS-4941-android-uaf-leaks-lifecycle`

Status legend: ✅ Ported · ❌ Missing · ⚠️ Partially ported / adapted · N/A Not applicable to that base

| # | Fix | Source (PR / commit) | Ticket | 2.34.1 | 2.33.4 | Notes |
|---|-----|----------------------|--------|--------|--------|-------|
| 1 | Subscriber use-after-free fix: read-once `StreamCache` (`AtomicReference`), session-level property changes pushed as plain values instead of re-reading the SDK | PR #297 (`1dd7738`) | VIDCS-4941 | ✅ | ✅ | Reimplemented by hand on both branches (not cherry-picked), architecturally equivalent to develop |
| 2 | Session listener teardown on unmount (`_eventSubscriptions`, missing `onSessionDisconnected`) + per-listener removal in `OTSessionHelper` | PR #297 (`fd64fb7`) | VIDCS-4941 | ✅ | ✅ | Already present before this backport work started |
| 3 | Subscriber stream-state dedupe (immutable update) + fixed `componentWillUnmount` listener removal (missing `sessionId` arg) | PR #297 (`cafc053`) | VIDCS-4941 | ✅ | ✅ | Already present before this backport work started |
| 4 | Event emission gating: `emitAudioLevel` / `emitAudioNetworkStats` / `emitVideoNetworkStats` props, native early-return guards, JS `undefined`-handler pattern | PR #297 (`03c9ae2`, `8c5c357`, `c035a82`) | VIDCS-4941 | ✅ | ✅ | Missing from the initial manual reimplementation on both branches; ported in this backport round |
| 5 | `getCapabilities()` guard against SIGSEGV in `libopentok` when the session isn't connected yet | PR #252 (`226400c`) | Fixes #156 (separate ticket) | ✅ | ✅ | Not a VIDCS-4941 fix, but same file/area; ported alongside gating |
| 6 | ISO 8601 UTC formatting for `creationTime` (`EventUtils.formatIso8601`), replacing locale-dependent `Date.toString()` | `06691fa`, `88afcc7` | VIDCS-3653 | ✅ | ✅ | Not a VIDCS-4941 fix; ported alongside gating since the subscriber cache needed it for parity |
| 7 | `jsonStats` as the preferred key (alongside deprecated `stats`/`jsonArrayOfReports`) on publisher/subscriber stats events, cross-platform key alignment | `6a44015`, `b656ee5`, `6f399fa` | VIDCS-3653 | ✅ | ⚠️ | Ported for publisher audio/video stats and subscriber `onRtcStatsReport`. Subscriber `onAudioStats`/`onVideoStats` keep each branch's pre-existing flat payload shape — restructuring that event contract was out of scope |
| 8 | Publisher audio/video stats emit `timestamp` alongside `startTime` to match iOS and the declared TS types | `61f0038` | Fixes #209 (separate ticket) | ✅ | ✅ | Not a VIDCS-4941 fix; bundled with #7 since it touches the same lines |
| 9 | `withParsedJsonStats` JS helper (parses `jsonStats`/`jsonArrayOfReports` into a `stats` field) for `onAudioNetworkStats`/`onVideoNetworkStats`/`onRtcStatsReport` | `6a44015` | VIDCS-3653 | ✅ | ✅ | Ported alongside #7 |
| 10 | `eventHandlers.subscriberDisconnected` fired alongside the existing `disconnected` handler | develop (bundled with gating work) | VIDCS-4941 | ✅ | ✅ | Ported alongside gating |
| 11 | Publisher teardown consolidation: `Utils.releasePublisher`/`releasePublisherIfSame`, single-owner unpublish, capturer release on view drop | PR #303 / VIDCS-5069 (`9fcfbee`, `283e41d`, `47f0213`) | VIDCS-5069 | ✅ | ✅ | 2.34.1: cherry-picked with `(cherry picked from commit ...)` trailers. 2.33.4: reimplemented manually in the same commit that redid the VIDCS-4941 cache fix |
| 12 | Initial connection stream fix | PR #304 (`02c221e`) | VIDCS-4941 (follow-up) | ✅ | ✅ | Same as #11 |
| 13 | Fabric component views seed a default `_props` in the constructor (RN 0.87 `NSInternalInconsistencyException` fix) | `a52563d` | RN 0.87 platform fix, not VIDCS-4941 | ❌ | ❌ | Deliberately excluded: both branches target RN 0.86, this only applies once the SDK moves to RN 0.87 |
| 14 | Screen capture uses the Activity's content view instead of the parent view (black-screen fix) | PR #274 (`4235d8d`) | Predates VIDCS-4941 (already in v2.33.3) | N/A | N/A | Landed before both backport branches' base tag; not part of this backport's scope |
| 15 | `sanitizeProperties` bug: `maxVideoBitrate` read `properties.videoBitratePreset` instead of `properties.maxVideoBitrate` | `dfbf307` (PR #296) | Unrelated bug fix | ❌ | ❌ | Confirmed still broken on both branches; not part of VIDCS-4941, flagged here for visibility |
| 16 | Android 12+ `BLUETOOTH_CONNECT` permission requested for Bluetooth audio, and made non-blocking on denial | `e601a12`, `699efa2` (VIDCS-4843) | VIDCS-4843 | ❌ | ❌ | Unrelated to VIDCS-4941; not ported |
| 17 | Native SDK bump to `2.35.2-alpha.0` (Camera2VideoCapturer NPE fix) | `b069a7d` | VIDCS-4941-adjacent | ❌ | ❌ | Both branches remain on `2.34.2-alpha.0` (Android). Deliberately excluded: a native SDK version bump is a larger-scope change outside "port the missing fixes" |
| 18 | RN bumped to 0.87.0 GA + Strict TypeScript API adoption | `00eda6b` and related | Platform upgrade | N/A | N/A | Both branches stay on RN 0.81.1; out of scope for a patch backport |

## Summary

- **Fully ported to both branches**: rows 1–3, 5, 6, 8–10 (all VIDCS-4941 core work, plus a few small fixes from other tickets that shared the same files and were bundled in for consistency).
- **Partially ported**: row 7 — the `jsonStats` alignment landed for publisher stats and subscriber RTC stats report, but the subscriber's `onAudioStats`/`onVideoStats` payload shape was intentionally left as-is to avoid an event-contract change beyond this backport's scope.
- **Deliberately not ported** (out of scope for this backport, not oversights): rows 13, 17, 18 (RN/SDK version-specific), 14 (already shipped before these branches existed).
- **Not ported and unrelated to VIDCS-4941** (flagged for separate follow-up, not part of this backport's mandate): rows 15 and 16.
