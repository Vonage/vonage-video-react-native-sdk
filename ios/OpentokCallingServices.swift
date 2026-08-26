import AVFoundation
import Foundation
import OpenTok
import React

/// Calling-services (CallKit) support.
///
/// The Vonage iOS SDK exposes `OTAudioSessionManager` from 2.31.0 onward. It is vended by
/// `OTAudioDeviceManager.currentAudioSessionManager()`, which returns the current audio device
/// **only if that device conforms to the protocol**. Per the SDK headers, "currently only the
/// default audio device supports this protocol" — so installing a custom audio device (which this
/// module does when `enableStereoOutput` is set) makes calling-services mode unavailable.
///
/// This module deliberately does not own a `CXProvider`. The application drives CallKit (directly
/// or via react-native-callkeep) and forwards the audio-session lifecycle here.
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

    /// Maps a JS mode string onto an `AVAudioSession.Mode`.
    ///
    /// Defaults to `videoChat`, matching the VERA CallKit plugin's production usage for
    /// Vonage video calls. (The SDK header cites `voiceChat` as the generic VoIP default;
    /// it stays selectable.)
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

    /// Forward from `provider(_:didActivate:)`.
    ///
    /// The protocol takes an `AVAudioSession`, which cannot cross the bridge. CallKit always hands
    /// back the shared instance, so that is what is passed through.
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
    //
    // Kept in the shared spec so app code can call them unconditionally; audio focus is an
    // Android Telecom concept with no iOS counterpart.

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
