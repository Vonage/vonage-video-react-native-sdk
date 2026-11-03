import AVFoundation
import Foundation
import OpenTok
import React

/// CallKit audio-session hooks. The app owns the `CXProvider` and forwards its lifecycle here.
/// Unavailable while a custom audio device is installed (e.g. `enableStereoOutput`).
extension OpentokReactNativeImpl {

    private static let unavailableMessage =
        "Calling services mode is unavailable. OTAudioSessionManager is only vended by the default "
        + "audio device; a custom audio device is currently installed (this happens when a session "
        + "is created with enableStereoOutput). Call isCallingServicesModeAvailable() to check."

    private func withAudioSessionManager(
        _ reject: @escaping RCTPromiseRejectBlock,
        _ body: (OTAudioSessionManager) -> Void
    ) {
        guard let manager = OTAudioDeviceManager.currentAudioSessionManager() else {
            reject("CALLING_SERVICES_UNAVAILABLE", Self.unavailableMessage, nil)
            return
        }
        body(manager)
    }

    /// Maps a JS mode string onto an `AVAudioSession.Mode`; defaults to `videoChat`.
    private static func audioSessionMode(from raw: String?) -> AVAudioSession.Mode {
        switch raw {
        case "voiceChat": return .voiceChat
        case "default": return .default
        default: return .videoChat
        }
    }

    @objc public func isCallingServicesModeAvailable(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve(OTAudioDeviceManager.currentAudioSessionManager() != nil)
    }

    /// Puts the SDK into manual AVAudioSession activation mode.
    /// Must be called early — at launch, or at least before the first call is answered.
    @objc public func enableCallingServicesMode(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        withAudioSessionManager(reject) { manager in
            manager.enableCallingServicesMode()
            resolve(nil)
        }
    }

    /// Configures (but does not activate) the audio session ahead of a CallKit action.
    /// Call from `CXAnswerCallAction` / `CXStartCallAction` handling.
    @objc public func preconfigureAudioSessionForCall(
        _ mode: String?,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        withAudioSessionManager(reject) { manager in
            manager.preconfigureAudioSessionForCall(withMode: Self.audioSessionMode(from: mode))
            resolve(nil)
        }
    }

    /// Forward from `provider(_:didActivate:)`. CallKit always passes the shared session.
    @objc public func notifyAudioSessionActivated(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        withAudioSessionManager(reject) { manager in
            manager.audioSessionDidActivate(AVAudioSession.sharedInstance())
            resolve(nil)
        }
    }

    /// Forward from `provider(_:didDeactivate:)`.
    @objc public func notifyAudioSessionDeactivated(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        withAudioSessionManager(reject) { manager in
            manager.audioSessionDidDeactivate(AVAudioSession.sharedInstance())
            resolve(nil)
        }
    }

    // MARK: - Android-only methods (no-ops on iOS)

    @objc public func setRequestAudioFocus(
        _ requestFocus: Bool,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve(nil)
    }

    @objc public func notifyAudioFocusActivated(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve(nil)
    }

    @objc public func notifyAudioFocusDeactivated(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve(nil)
    }
}
