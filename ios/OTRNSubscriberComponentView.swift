import Foundation
import OpenTok
import React

@objc public class OTRNSubscriberImpl: NSObject {
    private var sessionId: String?
    private var streamId: String?
    fileprivate weak var strictUIViewContainer:
        OTRNSubscriberComponentView?
    fileprivate var subscriberDelegateHandler: SubscriberDelegateHandler?
    fileprivate var subscriberUIView: UIView?
    fileprivate var subscriberRtcStatsDelegateHandler:
        SubscriberRtcStatsDelegateHandler?
    fileprivate var subscriberAudioLevelDelegateHandler:
        SubscriberAudioLevelDelegateHandler?
    fileprivate var subscriberNetworkStatsDelegateHandler:
        SubscriberNetworkStatsDelegateHandler?
    fileprivate var subscriberCaptionsDelegateHandler:
        SubscriberCaptionsDelegateHandler?

    @objc public var subscriberView: UIView {
        if let subscriberUIView = subscriberUIView {
            return subscriberUIView
        }
        return UIView()
    }

    @objc public init(view: OTRNSubscriberComponentView) {
        super.init()
        self.strictUIViewContainer = view
        subscriberDelegateHandler = SubscriberDelegateHandler(impl: self)
        subscriberRtcStatsDelegateHandler = SubscriberRtcStatsDelegateHandler(
            impl: self)
        subscriberAudioLevelDelegateHandler =
            SubscriberAudioLevelDelegateHandler(impl: self)
        subscriberNetworkStatsDelegateHandler =
            SubscriberNetworkStatsDelegateHandler(impl: self)
        subscriberCaptionsDelegateHandler =
            SubscriberCaptionsDelegateHandler(impl: self)
    }

    // Copies the latest stream metadata snapshot from the main subscriber
    // delegate into other delegate handlers that also emit stream payloads.
    // This keeps all handlers aligned without each one reading OTKit stream
    // properties independently.
    private func distributeStreamDataCache() {
        guard let handler = subscriberDelegateHandler,
              let streamData = handler.getCachedStreamData() else {
            return
        }
        subscriberRtcStatsDelegateHandler?.setCachedStreamData(streamData)
        subscriberAudioLevelDelegateHandler?.setCachedStreamData(streamData)
        subscriberNetworkStatsDelegateHandler?.setCachedStreamData(streamData)
        subscriberCaptionsDelegateHandler?.setCachedStreamData(streamData)
    }

    // Clears all cached stream metadata from all delegate handlers.
    // Called on cleanup and before subscribing to a new stream to prevent
    // stale data from previous subscribers (Fabric reuses _impl after recycle).
    // Must be called even if subscriber lookup fails in cleanup().
    private func clearAllStreamDataCaches() {
        subscriberDelegateHandler?.clearCachedStreamData()
        subscriberRtcStatsDelegateHandler?.clearCachedStreamData()
        subscriberAudioLevelDelegateHandler?.clearCachedStreamData()
        subscriberNetworkStatsDelegateHandler?.clearCachedStreamData()
        subscriberCaptionsDelegateHandler?.clearCachedStreamData()
    }

    @objc public func createSubscriber(_ properties: NSDictionary) {
        // Clear any stale cached stream data from previous subscribers before
        // subscribing to a new stream. This is critical on Fabric where _impl
        // is reused after view recycle; without clearing, early stats/audio/captions
        // callbacks could emit data from a previous stream until subscriberDidConnect
        // repopulates the cache.
        clearAllStreamDataCaches()

        self.sessionId = Utils.sanitizeStringProperty(
            properties["sessionId"] as Any)
        self.streamId = Utils.sanitizeStringProperty(
            properties["streamId"] as Any)
        guard let streamId = self.streamId,
            let stream = OTRN.sharedState.subscriberStreams[streamId]
        else {
            strictUIViewContainer?.handleError([
                "streamId": streamId ?? "",
                "errorMessage": "Could not find stream",
            ])
            return
        }

        guard
            let subscriber = OTSubscriber(
                stream: stream, delegate: subscriberDelegateHandler)
        else {
            strictUIViewContainer?.handleError([
                "streamId": streamId,
                "errorMessage":
                    "Error subscribing. Could not create subscriber.",
            ])
            return
        }

        guard let session = OTRN.sharedState.sessions[sessionId ?? ""] else {
            strictUIViewContainer?.handleError([
                "streamId": streamId,
                "errorMessage":
                    "Error subscribing. Could not find native session instance.",
            ])
            return
        }

        subscriber.rtcStatsReportDelegate = subscriberRtcStatsDelegateHandler
        subscriber.audioLevelDelegate = subscriberAudioLevelDelegateHandler
        subscriber.networkStatsDelegate = subscriberNetworkStatsDelegateHandler
        subscriber.captionsDelegate = subscriberCaptionsDelegateHandler

        subscriber.subscribeToAudio = Utils.sanitizeBooleanProperty(
            properties["subscribeToAudio"] as Any)
        subscriber.subscribeToVideo = Utils.sanitizeBooleanProperty(
            properties["subscribeToVideo"] as Any)
        subscriber.subscribeToCaptions = Utils.sanitizeBooleanProperty(
            properties["subscribeToCaptions"] as Any)
        subscriber.preferredFrameRate = Utils.sanitizePreferredFrameRate(
            properties["preferredFrameRate"] as Any)
        subscriber.preferredResolution = Utils.sanitizePreferredResolution(
            properties["preferredResolution"] as Any)
        subscriber.viewScaleBehavior = Utils.sanitizeStringProperty(properties["scaleBehavior"]).toViewScaleBehavior

        var error: OTError?
        session.subscribe(subscriber, error: &error)
        if let err = error {
            strictUIViewContainer?.handleError([
                "streamId": streamId,
                "errorMessage": err.localizedDescription,
            ])
            return
        }
        OTRN.sharedState.subscribers.updateValue(subscriber, forKey: streamId)

        if let audioVolume = properties["audioVolume"] as? Double {
            subscriber.audioVolume = audioVolume
        }
        if let subView = subscriber.view {
            subView.frame = strictUIViewContainer?.bounds ?? .zero
            subscriberUIView = subView
        }
    }

    @objc public func setSessionId(_ sessionId: String) {
        self.sessionId = sessionId
    }

    @objc public func setStreamId(_ streamId: String) {
        self.streamId = streamId
    }

    @objc public func setSubscribeToAudio(_ subscribeToAudio: Bool) {

        guard let subscriber = OTRN.sharedState.subscribers[streamId ?? ""]
        else {
            return
        }
        subscriber.subscribeToAudio = subscribeToAudio
    }

    @objc public func setSubscribeToVideo(_ subscribeToVideo: Bool) {

        guard let subscriber = OTRN.sharedState.subscribers[streamId ?? ""]
        else { return }
        subscriber.subscribeToVideo = subscribeToVideo

    }

    @objc public func setSubscribeToCaptions(_ subscribeToCaptions: Bool) {
        guard let subscriber = OTRN.sharedState.subscribers[streamId ?? ""]
        else { return }
        subscriber.subscribeToCaptions = subscribeToCaptions
    }

    @objc public func setScaleBehavior(_ scaleBehavior: String) {
        guard let subscriber = OTRN.sharedState.subscribers[streamId ?? ""]
        else { return }
        subscriber.viewScaleBehavior = scaleBehavior.toViewScaleBehavior
    }

    @objc public func cleanup() {
        if Thread.isMainThread {
            self._cleanupImpl()
        } else {
            DispatchQueue.main.async { [weak self] in
                self?._cleanupImpl()
            }
        }
    }

    private func _cleanupImpl() {
        // Always clear cached stream data on cleanup, even if subscriber lookup fails.
        // This ensures stale cache entries don't leak across recycles on Fabric.
        clearAllStreamDataCaches()

        guard let streamId = self.streamId,
            let subscriber = OTRN.sharedState.subscribers[streamId]
        else {
            // Reset state regardless of whether subscriber exists.
            // Previous early return prevented this, creating state leaks.
            self.streamId = ""
            self.subscriberUIView = nil
            return
        }

        subscriber.view?.removeFromSuperview()
        subscriber.delegate = nil
        subscriber.audioLevelDelegate = nil
        subscriber.networkStatsDelegate = nil
        subscriber.rtcStatsReportDelegate = nil
        subscriber.captionsDelegate = nil
        OTRN.sharedState.subscribers.removeValue(forKey: streamId)
        self.sessionId = ""
        self.streamId = ""
        self.subscriberUIView = nil
    }
}

private class SubscriberDelegateHandler: NSObject, OTSubscriberDelegate {
    weak var impl: OTRNSubscriberImpl?
    // Cached stream metadata used by high-frequency callbacks.
    // It is optional because callbacks can happen before first successful
    // stream snapshot is captured.
    private var cachedStreamData: [String: Any]?
    // Concurrent queue for readers/writers access:
    // - reads use sync and can run concurrently
    // - writes use barrier for exclusive updates
    private let cacheQueue = DispatchQueue(label: "subscriber.stream-cache", attributes: .concurrent)

    init(impl: OTRNSubscriberImpl) {
        super.init()
        self.impl = impl
    }

    // Refreshes snapshot from OTKit stream object.
    // Barrier write avoids races with concurrent readers.
    // Use sync here because callers immediately read/emit after refresh, so we avoid data staleness.
    private func updateCachedStreamData(_ stream: OTStream) {
        cacheQueue.sync(flags: .barrier) {
            self.cachedStreamData = EventUtils.prepareJSStreamEventData(stream)
        }
    }

    // Returns the latest stream metadata snapshot.
    // Read path is intentionally lightweight for frequent callers.
    func getCachedStreamData() -> [String: Any]? {
        return cacheQueue.sync {
            return self.cachedStreamData
        }
    }

    // Clears the cached stream data by setting to nil using barrier write.
    // This ensures readers don't see partial state during transition.
    func clearCachedStreamData() {
        cacheQueue.sync(flags: .barrier) {
            self.cachedStreamData = nil
        }
    }

    func subscriberDidConnect(toStream subscriber: OTSubscriberKit) {
        if let stream = subscriber.stream,
            let impl = impl
        {
            // Prime cache on connect, then propagate it to other handlers.
            updateCachedStreamData(stream)
            impl.distributeStreamDataCache()
            let streamInfo: [String: Any] = [
                "stream": getCachedStreamData() ?? [:]
            ]
            impl.strictUIViewContainer?.handleSubscriberConnected(streamInfo)
        }
    }

    func subscriber(
        _ subscriber: OTSubscriberKit, didFailWithError error: OTError
    ) {
        var subscriberInfo: [String: Any] = [
            "error": EventUtils.prepareJSErrorEventData(error)
        ]

        // Always include "stream" key, even if nil (to match TS definition)
        if let stream = subscriber.stream {
            subscriberInfo["stream"] = EventUtils.prepareJSStreamEventData(
                stream)
        } else {
            subscriberInfo["stream"] = NSNull()
        }

        if let impl = impl {
            impl.strictUIViewContainer?.handleError(subscriberInfo)
        }
    }

    func subscriberDidDisconnect(fromStream subscriber: OTSubscriberKit) {
        if let stream = subscriber.stream,
            let impl = impl
        {
            let streamInfo: [String: Any] = [
                "stream": EventUtils.prepareJSStreamEventData(stream)
            ]
            impl.strictUIViewContainer?.handleSubscriberDisconnected(streamInfo)
        }
    }

    func subscriberVideoEnabled(
        _ subscriber: OTSubscriberKit, reason: OTSubscriberVideoEventReason
    ) {
        var subscriberInfo: [String: Any] = [
            "reason": Utils.convertOTSubscriberVideoEventReasonToString(reason)
        ]

        if let stream = subscriber.stream {
            // Video state change may affect stream metadata; refresh snapshot.
            updateCachedStreamData(stream)
            if let impl = impl {
                impl.distributeStreamDataCache()
            }
            subscriberInfo["stream"] = getCachedStreamData() ?? [:]
        } else {
            subscriberInfo["stream"] = NSNull()
        }

        if let impl = impl {
            impl.strictUIViewContainer?.handleVideoEnabled(subscriberInfo)
        }
    }

    func subscriberVideoDisabled(
        _ subscriber: OTSubscriberKit, reason: OTSubscriberVideoEventReason
    ) {
        var subscriberInfo: [String: Any] = [
            "reason": Utils.convertOTSubscriberVideoEventReasonToString(reason)
        ]

        // Always include "stream" key, even if nil (to match TS definition)
        if let stream = subscriber.stream {
            // Video state change may affect stream metadata; refresh snapshot.
            updateCachedStreamData(stream)
            if let impl = impl {
                impl.distributeStreamDataCache()
            }
            subscriberInfo["stream"] = getCachedStreamData() ?? [:]
        } else {
            subscriberInfo["stream"] = NSNull()
        }

        if let impl = impl {
            impl.strictUIViewContainer?.handleVideoDisabled(subscriberInfo)
        }
    }

    func subscriberVideoDisableWarning(_ subscriber: OTSubscriberKit) {
        var subscriberInfo: [String: Any] = [:]
        if let stream = subscriber.stream {
            subscriberInfo["stream"] = EventUtils.prepareJSStreamEventData(
                stream)
        } else {
            subscriberInfo["stream"] = NSNull()
        }
        if let impl = impl {
            impl.strictUIViewContainer?.handleVideoDisableWarning(
                subscriberInfo)
        }
    }

    func subscriberVideoDisableWarningLifted(_ subscriber: OTSubscriberKit) {
        var subscriberInfo: [String: Any] = [:]
        if let stream = subscriber.stream {
            subscriberInfo["stream"] = EventUtils.prepareJSStreamEventData(
                stream)
        } else {
            subscriberInfo["stream"] = NSNull()
        }
        if let impl = impl {
            impl.strictUIViewContainer?.handleVideoDisableWarningLifted(
                subscriberInfo)
        }
    }

    func subscriberVideoDataReceived(_ subscriber: OTSubscriber) {
        var subscriberInfo: [String: Any] = [:]
        // This callback fires when video data starts arriving, not continuously.
        // Use direct OTKit stream lookup here; cache fast-path is unnecessary.
        if let stream = subscriber.stream {
            subscriberInfo["stream"] = EventUtils.prepareJSStreamEventData(
                stream)
        } else {
            subscriberInfo["stream"] = NSNull()
        }
        if let impl = impl {
            impl.strictUIViewContainer?.handleVideoDataReceived(subscriberInfo)
        }
    }

    func subscriberDidReconnect(toStream subscriber: OTSubscriberKit) {
        var subscriberInfo: [String: Any] = [:]
        if let stream = subscriber.stream {
            // Refresh cache on reconnect: stream state may have changed while
            // disconnected. Keep emitted payload aligned with current metadata.
            updateCachedStreamData(stream)
            if let impl = impl {
                impl.distributeStreamDataCache()
            }
            subscriberInfo["stream"] = getCachedStreamData() ?? [:]
        } else {
            subscriberInfo["stream"] = NSNull()
        }
        if let impl = impl {
            impl.strictUIViewContainer?.handleReconnected(subscriberInfo)
        }
    }
}

private class SubscriberRtcStatsDelegateHandler: NSObject,
    OTSubscriberKitRtcStatsReportDelegate
{
    weak var impl: OTRNSubscriberImpl?
    // Snapshot copied from SubscriberDelegateHandler to avoid repeated
    // stream object access in stats callbacks.
    private var cachedStreamData: [String: Any]?
    // Concurrent read / barrier write queue for cache synchronization.
    private let cacheQueue = DispatchQueue(label: "subscriber.rtcstats-cache", attributes: .concurrent)

    init(impl: OTRNSubscriberImpl) {
        super.init()
        self.impl = impl

    }

    func setCachedStreamData(_ streamData: [String: Any]) {
        // Exclusive write to prevent partial updates visible to readers.
        cacheQueue.sync(flags: .barrier) {
            self.cachedStreamData = streamData
        }
    }

    private func getCachedStreamData() -> [String: Any]? {
        return cacheQueue.sync {
            return self.cachedStreamData
        }
    }

    func clearCachedStreamData() {
        cacheQueue.sync(flags: .barrier) {
            self.cachedStreamData = nil
        }
    }

    func subscriber(_ subscriber: OTSubscriberKit, rtcStatsReport: String) {
        var subscriberInfo: [String: Any] = [
            "jsonStats": rtcStatsReport
        ]
        if let cachedStream = getCachedStreamData() {
            subscriberInfo["stream"] = cachedStream
        } else {
            subscriberInfo["stream"] = NSNull()
        }
        if let impl = impl {
            impl.strictUIViewContainer?.handleRtcStatsReport(subscriberInfo)
        }
    }
}

private class SubscriberAudioLevelDelegateHandler: NSObject,
    OTSubscriberKitAudioLevelDelegate
{
    weak var impl: OTRNSubscriberImpl?
    // Audio level can be frequent; reuse cached stream metadata.
    private var cachedStreamData: [String: Any]?
    // Concurrent read / barrier write queue for cache synchronization.
    private let cacheQueue = DispatchQueue(label: "subscriber.audiolevel-cache", attributes: .concurrent)

    init(impl: OTRNSubscriberImpl) {
        super.init()
        self.impl = impl

    }

    func setCachedStreamData(_ streamData: [String: Any]) {
        // Exclusive write to prevent partial updates visible to readers.
        cacheQueue.sync(flags: .barrier) {
            self.cachedStreamData = streamData
        }
    }

    private func getCachedStreamData() -> [String: Any]? {
        return cacheQueue.sync {
            return self.cachedStreamData
        }
    }

    func clearCachedStreamData() {
        cacheQueue.sync(flags: .barrier) {
            self.cachedStreamData = nil
        }
    }

    func subscriber(
        _ subscriber: OTSubscriberKit, audioLevelUpdated audioLevel: Float
    ) {
        var subscriberInfo: [String: Any] = [
            "audioLevel": audioLevel
        ]
        if let cachedStream = getCachedStreamData() {
            subscriberInfo["stream"] = cachedStream
        } else {
            subscriberInfo["stream"] = NSNull()
        }
        if let impl = impl {
            impl.strictUIViewContainer?.handleAudioLevel(subscriberInfo)
        }
    }
}

private class SubscriberNetworkStatsDelegateHandler: NSObject,
    OTSubscriberKitNetworkStatsDelegate
{
    weak var impl: OTRNSubscriberImpl?
    // Network stats callbacks reuse the same stream metadata snapshot.
    private var cachedStreamData: [String: Any]?
    // Concurrent read / barrier write queue for cache synchronization.
    private let cacheQueue = DispatchQueue(label: "subscriber.networkstats-cache", attributes: .concurrent)

    init(impl: OTRNSubscriberImpl) {
        super.init()
        self.impl = impl
    }

    func setCachedStreamData(_ streamData: [String: Any]) {
        // Exclusive write to prevent partial updates visible to readers.
        cacheQueue.sync(flags: .barrier) {
            self.cachedStreamData = streamData
        }
    }

    private func getCachedStreamData() -> [String: Any]? {
        return cacheQueue.sync {
            return self.cachedStreamData
        }
    }

    func clearCachedStreamData() {
        cacheQueue.sync(flags: .barrier) {
            self.cachedStreamData = nil
        }
    }

    func subscriber(
        _ subscriber: OTSubscriberKit,
        videoNetworkStatsUpdated stats: OTSubscriberKitVideoNetworkStats
    ) {
        var statsDict: Dictionary<String, Any> = EventUtils.prepareSubscriberVideoNetworkStatsEventData(stats);

        var subscriberInfo: [String: Any] = [:]
        if let jsonData = try? JSONSerialization.data(
            withJSONObject: statsDict),
            let jsonString = String(data: jsonData, encoding: .utf8)
        {
            subscriberInfo["jsonStats"] = jsonString
        } else {
            subscriberInfo["jsonStats"] = ""
        }

        if let cachedStream = getCachedStreamData() {
            subscriberInfo["stream"] = cachedStream
        } else {
            subscriberInfo["stream"] = NSNull()
        }

        if let impl = impl {
            impl.strictUIViewContainer?.handleVideoNetworkStats(subscriberInfo)
        }
    }

    func subscriber(
        _ subscriber: OTSubscriberKit,
        audioNetworkStatsUpdated stats: OTSubscriberKitAudioNetworkStats
    ) {
        let statsDict: [String: Any] = [
            "audioPacketsLost": stats.audioPacketsLost,
            "audioBytesReceived": stats.audioBytesReceived,
            "audioPacketsReceived": stats.audioPacketsReceived,
            "timestamp": stats.timestamp,
        ]

        var subscriberInfo: [String: Any] = [:]
        if let jsonData = try? JSONSerialization.data(
            withJSONObject: statsDict),
            let jsonString = String(data: jsonData, encoding: .utf8)
        {
            subscriberInfo["jsonStats"] = jsonString
        } else {
            subscriberInfo["jsonStats"] = ""
        }

        if let cachedStream = getCachedStreamData() {
            subscriberInfo["stream"] = cachedStream
        } else {
            subscriberInfo["stream"] = NSNull()
        }

        if let impl = impl {
            impl.strictUIViewContainer?.handleAudioNetworkStats(subscriberInfo)
        }
    }
}

private class SubscriberCaptionsDelegateHandler: NSObject,
    OTSubscriberKitCaptionsDelegate
{
    weak var impl: OTRNSubscriberImpl?
    // Captions events include stream payload; reuse cached metadata snapshot.
    private var cachedStreamData: [String: Any]?
    // Concurrent read / barrier write queue for cache synchronization.
    private let cacheQueue = DispatchQueue(label: "subscriber.captions-cache", attributes: .concurrent)

    init(impl: OTRNSubscriberImpl) {
        super.init()
        self.impl = impl
    }

    func setCachedStreamData(_ streamData: [String: Any]) {
        // Exclusive write to prevent partial updates visible to readers.
        cacheQueue.sync(flags: .barrier) {
            self.cachedStreamData = streamData
        }
    }

    private func getCachedStreamData() -> [String: Any]? {
        return cacheQueue.sync {
            return self.cachedStreamData
        }
    }

    func clearCachedStreamData() {
        cacheQueue.sync(flags: .barrier) {
            self.cachedStreamData = nil
        }
    }

    func subscriber(
        _ subscriber: OTSubscriberKit, caption text: String, isFinal: Bool
    ) {
        var subscriberInfo: [String: Any] = [
            "text": text,
            "isFinal": isFinal,
        ]
        if let cachedStream = getCachedStreamData() {
            subscriberInfo["stream"] = cachedStream
        } else {
            subscriberInfo["stream"] = NSNull()
        }
        if let impl = impl {
            impl.strictUIViewContainer?.handleCaptionReceived(subscriberInfo)
        }
    }
}
