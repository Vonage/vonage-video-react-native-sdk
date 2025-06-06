//
//  OTSessionManager.swift
//  OpenTokReactNative
//
//  Created by Manik Sachdeva on 1/12/18.
//  Copyright © 2018 Facebook. All rights reserved.
//

import Foundation

@objc(OTSessionManager)
class OTSessionManager: RCTEventEmitter {
    
    var jsEvents: [String] = [];
    var componentEvents: [String] = [];
    var logLevel: Bool = false;
    
    deinit {
        OTRN.sharedState.subscriberStreams.removeAll();
        OTRN.sharedState.sessions.removeAll();
        OTRN.sharedState.sessionConnectCallbacks.removeAll();
        OTRN.sharedState.sessionDisconnectCallbacks.removeAll();
        OTRN.sharedState.isPublishing.removeAll();
        OTRN.sharedState.publishers.removeAll();
        OTRN.sharedState.subscribers.removeAll();
        OTRN.sharedState.publisherDestroyedCallbacks.removeAll();
        OTRN.sharedState.publisherStreams.removeAll();
        OTRN.sharedState.streamObservers.removeAll();
        OTRN.sharedState.connections.removeAll();
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return true;
    }
    
    @objc override func supportedEvents() -> [String] {
        let allEvents = EventUtils.getSupportedEvents();
        return allEvents + jsEvents
    }
    
    @objc func initSession(_ apiKey: String, sessionId: String, sessionOptions: Dictionary<String, Any>) -> Void {
        let enableStereoOutput: Bool = Utils.sanitizeBooleanProperty(sessionOptions["enableStereoOutput"] as Any);
        if enableStereoOutput == true {
            let customAudioDevice = OTCustomAudioDriver()
            OTAudioDeviceManager.setAudioDevice(customAudioDevice)
        }
        let settings = OTSessionSettings();
        settings.connectionEventsSuppressed = Utils.sanitizeBooleanProperty(sessionOptions["connectionEventsSuppressed"] as Any);
        // Note: IceConfig is an additional property not supported at the moment. We need to add a sanitize function
        // to validate the input from settings.iceConfig.
        // settings.iceConfig = sessionOptions["iceConfig"];
        settings.proxyURL = Utils.sanitizeStringProperty(sessionOptions["proxyUrl"] as Any);
        settings.ipWhitelist = Utils.sanitizeBooleanProperty(sessionOptions["ipWhitelist"] as Any);
        settings.iceConfig = Utils.sanitizeIceServer(sessionOptions["customServers"] as Any, sessionOptions["transportPolicy"] as Any, sessionOptions["includeServers"] as Any, Utils.sanitizeBooleanProperty(sessionOptions["filterOutLanCandidates"]));
        settings.singlePeerConnection = Utils.sanitizeBooleanProperty(sessionOptions["enableSinglePeerConnection"] as Any);
        settings.sessionMigration = Utils.sanitizeBooleanProperty(sessionOptions["sessionMigration"] as Any);
        OTRN.sharedState.sessions.updateValue(OTSession(apiKey: apiKey, sessionId: sessionId, delegate: self, settings: settings)!, forKey: sessionId);
    }
    
    @objc func connect(_ sessionId: String, token: String, callback: @escaping RCTResponseSenderBlock) -> Void {
        var error: OTError?
        guard let session = OTRN.sharedState.sessions[sessionId] else {
            let errorInfo = EventUtils.createErrorMessage("Error connecting to session. Could not find native session instance")
            callback([errorInfo]);
            return
        }
        session.connect(withToken: token, error: &error)
        if let err = error {
            self.dispatchErrorViaCallback(callback, error: err)
        } else {
            OTRN.sharedState.sessionConnectCallbacks[sessionId] = callback;
        }
    }
    
    @objc func initPublisher(_ publisherId: String, properties: Dictionary<String, Any>, callback: @escaping RCTResponseSenderBlock) -> Void {
        DispatchQueue.main.async {
            let publisherProperties = OTPublisherSettings()
            publisherProperties.videoTrack = Utils.sanitizeBooleanProperty(properties["videoTrack"] as Any);
            publisherProperties.audioTrack = Utils.sanitizeBooleanProperty(properties["audioTrack"] as Any);
            if let audioBitrate = properties["audioBitrate"] as? Int {
                publisherProperties.audioBitrate = Int32(audioBitrate);
            }
            publisherProperties.cameraFrameRate = Utils.sanitizeFrameRate(properties["frameRate"] as Any);
            publisherProperties.cameraResolution = Utils.sanitizeCameraResolution(properties["resolution"] as Any);
            publisherProperties.enableOpusDtx = Utils.sanitizeBooleanProperty(properties["enableDtx"] as Any);
            publisherProperties.name = properties["name"] as? String;
            publisherProperties.publisherAudioFallbackEnabled = Utils.sanitizeBooleanProperty(properties["publisherAudioFallback"] as Any);
            publisherProperties.subscriberAudioFallbackEnabled = Utils.sanitizeBooleanProperty(properties["subscriberAudioFallback"] as Any);
            publisherProperties.videoCapture?.videoContentHint = Utils.convertVideoContentHint(properties["videoContentHint"] as Any)
            OTRN.sharedState.publishers.updateValue(OTPublisher(delegate: self, settings: publisherProperties)!, forKey: publisherId);
            guard let publisher = OTRN.sharedState.publishers[publisherId] else {
                let errorInfo = EventUtils.createErrorMessage("There was an error creating the native publisher instance")
                callback([errorInfo]);
                return
            }
            if let videoSource = properties["videoSource"] as? String, videoSource == "screen" {
                guard let screenView = RCTPresentedViewController()?.view else {
                    let errorInfo = EventUtils.createErrorMessage("There was an error setting the videoSource as screen")
                    callback([errorInfo]);
                    if let scalableScreenshare = properties["scalableScreenshare"] as? Bool {
                        publisherProperties.scalableScreenshare = scalableScreenshare;
                    }
                    return
                }
                publisher.videoType = .screen;
                publisher.videoCapture = OTScreenCapture(view: (screenView))
            } else if let cameraPosition = properties["cameraPosition"] as? String {
                publisher.cameraPosition = cameraPosition == "front" ? .front : .back;
            }
            publisher.audioFallbackEnabled = Utils.sanitizeBooleanProperty(properties["audioFallbackEnabled"] as Any);
            publisher.publishAudio = Utils.sanitizeBooleanProperty(properties["publishAudio"] as Any);
            publisher.publishVideo = Utils.sanitizeBooleanProperty(properties["publishVideo"] as Any);
            publisher.publishCaptions = Utils.sanitizeBooleanProperty(properties["publishCaptions"] as Any);
            publisher.cameraTorch = Utils.sanitizeBooleanProperty(properties["cameraTorch"] as Any);
            if let cameraZoomFactor = properties["cameraZoomFactor"] as? Float {
                publisher.cameraZoomFactor = cameraZoomFactor;
            }
            publisher.audioLevelDelegate = self;
            publisher.networkStatsDelegate = self;
            publisher.rtcStatsReportDelegate = self;
            callback([NSNull()]);
        }
    }
    
    @objc func publish(_ sessionId: String, publisherId: String, callback: RCTResponseSenderBlock) -> Void {
        var error: OTError?
        guard let publisher = OTRN.sharedState.publishers[publisherId] else {
            let errorInfo = EventUtils.createErrorMessage("Error publishing. Could not find native publisher instance")
            callback([errorInfo]);
            return
        }
        guard let session = OTRN.sharedState.sessions[sessionId] else {
            let errorInfo = EventUtils.createErrorMessage("Error connecting to session. Could not find native session instance")
            callback([errorInfo]);
            return
        }
        session.publish(publisher, error: &error)
        if let err = error {
            dispatchErrorViaCallback(callback, error: err)
        } else {
            callback([NSNull()])
        }
    }
    
    @objc func subscribeToStream(_ streamId: String, sessionId: String, properties: Dictionary<String, Any>, callback: @escaping RCTResponseSenderBlock) -> Void {
        var error: OTError?
        DispatchQueue.main.async {
            guard let stream = OTRN.sharedState.subscriberStreams[streamId] else {
                let errorInfo = EventUtils.createErrorMessage("Error subscribing. Could not find native stream for subscriber.")
                callback([errorInfo]);
                return
            }
            guard let subscriber = OTSubscriber(stream: stream, delegate: self) else {
                let errorInfo = EventUtils.createErrorMessage("Error subscribing. Could not create subscriber.")
                callback([errorInfo]);
                return
            }
            guard let session = OTRN.sharedState.sessions[sessionId] else {
                let errorInfo = EventUtils.createErrorMessage("Error subscribing to stream. Could not find native session instance")
                callback([errorInfo]);
                return
            }
            OTRN.sharedState.subscribers.updateValue(subscriber, forKey: streamId)
            subscriber.networkStatsDelegate = self;
            subscriber.audioLevelDelegate = self;
            subscriber.captionsDelegate = self;
            session.subscribe(subscriber, error: &error)
            subscriber.subscribeToAudio = Utils.sanitizeBooleanProperty(properties["subscribeToAudio"] as Any);
            subscriber.subscribeToVideo = Utils.sanitizeBooleanProperty(properties["subscribeToVideo"] as Any);
            subscriber.subscribeToCaptions = Utils.sanitizeBooleanProperty(properties["subscribeToCaptions"] as Any);
            subscriber.preferredFrameRate = Utils.sanitizePreferredFrameRate(properties["preferredFrameRate"] as Any);
            subscriber.preferredResolution = Utils.sanitizePreferredResolution(properties["preferredResolution"] as Any);
            if let audioVolume = properties["audioVolume"] as? Double {
              subscriber.audioVolume = audioVolume;
            }
            subscriber.rtcStatsReportDelegate = self;
            subscriber.captionsDelegate = self;
            if let err = error {
                self.dispatchErrorViaCallback(callback, error: err)
            } else {
                callback([NSNull(), streamId])
            }
        }
    }
    
    @objc func removeSubscriber(_ streamId: String, callback: @escaping RCTResponseSenderBlock) -> Void {
        DispatchQueue.main.async {
            OTRN.sharedState.streamObservers.removeValue(forKey: streamId);
            guard let subscriber = OTRN.sharedState.subscribers[streamId] else {
                self.removeStream(streamId)
                callback([NSNull()])
                return
            }
            subscriber.view?.removeFromSuperview();
            subscriber.delegate = nil;
            self.removeStream(streamId)
            callback([NSNull()])
        }
        
    }
    
    @objc func disconnectSession(_ sessionId: String, callback: @escaping RCTResponseSenderBlock) -> Void {
        var error: OTError?
        guard let session = OTRN.sharedState.sessions[sessionId] else {
            let errorInfo = EventUtils.createErrorMessage("Error disconnecting from session. Could not find native session instance")
            callback([errorInfo]);
            return
        }
        session.disconnect(&error)
        if let err = error {
            dispatchErrorViaCallback(callback, error: err)
        } else {
            OTRN.sharedState.sessionDisconnectCallbacks[sessionId] = callback;
        }
    }
    
    @objc func publishAudio(_ publisherId: String, pubAudio: Bool) -> Void {
        guard let publisher = OTRN.sharedState.publishers[publisherId] else { return }
        publisher.publishAudio = pubAudio;
    }
    
    @objc func publishVideo(_ publisherId: String, pubVideo: Bool) -> Void {
        guard let publisher = OTRN.sharedState.publishers[publisherId] else { return }
        publisher.publishVideo = pubVideo;
    }

    @objc func publishCaptions(_ publisherId: String, pubCaptions: Bool) -> Void {
        guard let publisher = OTRN.sharedState.publishers[publisherId] else { return }
        publisher.publishCaptions = pubCaptions;
    }
    
    @objc func cameraTorch(_ publisherId: String, cameraTorch: Bool) -> Void {
        guard let publisher = OTRN.sharedState.publishers[publisherId] else { return }
        publisher.cameraTorch = cameraTorch;
    }
    
    @objc func cameraZoomFactor(_ publisherId: String, cameraZoomFactor: Float) -> Void {
        guard let publisher = OTRN.sharedState.publishers[publisherId] else { return }
        publisher.cameraZoomFactor = cameraZoomFactor;
    }
    
    @objc func getRtcStatsReport(_ publisherId: String) -> Void {
        guard let publisher = OTRN.sharedState.publishers[publisherId] else { return }
        publisher.getRtcStatsReport()
    }
    
    @objc func subscribeToAudio(_ streamId: String, subAudio: Bool) -> Void {
        guard let subscriber = OTRN.sharedState.subscribers[streamId] else { return }
        subscriber.subscribeToAudio = subAudio;
    }
    
    @objc func subscribeToVideo(_ streamId: String, subVideo: Bool) -> Void {
        guard let subscriber = OTRN.sharedState.subscribers[streamId] else { return }
        subscriber.subscribeToVideo = subVideo;
    }
    
    @objc func subscribeToCaptions(_ streamId: String, subCaptions: Bool) -> Void {
        guard let subscriber = OTRN.sharedState.subscribers[streamId] else { return }
        subscriber.subscribeToCaptions = subCaptions;
    }
    
    @objc func setPreferredResolution(_ streamId: String, resolution: NSDictionary) -> Void {
        guard let subscriber = OTRN.sharedState.subscribers[streamId] else { return }
        subscriber.preferredResolution = Utils.sanitizePreferredResolution(resolution);
    }
    
    @objc func setPreferredFrameRate(_ streamId: String, frameRate: Float) -> Void {
        guard let subscriber = OTRN.sharedState.subscribers[streamId] else { return }
        subscriber.preferredFrameRate = Utils.sanitizePreferredFrameRate(frameRate);
    }
    
    @objc func setAudioVolume(_ streamId: String, audioVolume: Double) -> Void {
        guard let subscriber = OTRN.sharedState.subscribers[streamId] else { return }
        subscriber.audioVolume = audioVolume;
    }
    
    @objc func getSubscriberRtcStatsReport() -> Void {
        for subscriber in OTRN.sharedState.subscribers {
            subscriber.value.getRtcStatsReport()
        }
    }
    
    @objc func changeCameraPosition(_ publisherId: String, cameraPosition: String) -> Void {
        guard let publisher = OTRN.sharedState.publishers[publisherId] else { return }
        publisher.cameraPosition = cameraPosition == "front" ? .front : .back;
    }
    
    @objc func changeVideoContentHint(_ publisherId: String, videoContentHint: String) -> Void {
        guard let publisher = OTRN.sharedState.publishers[publisherId] else { return }
        publisher.videoCapture?.videoContentHint = Utils.convertVideoContentHint(videoContentHint);
    }
    
    @objc func setNativeEvents(_ events: Array<String>) -> Void {
        for event in events {
            if (!self.jsEvents.contains(event)) {
                self.jsEvents.append(event);
            }
        }
    }
    
    @objc func setJSComponentEvents(_ events: Array<String>) -> Void {
        for event in events {
            self.componentEvents.append(event);
        }
    }
    
    @objc func removeJSComponentEvents(_ events: Array<String>) -> Void {
        for event in events {
            if let i = self.componentEvents.index(of: event) {
                self.componentEvents.remove(at: i)
            }
        }
    }
    
    @objc func sendSignal(_ sessionId: String, signal: Dictionary<String, String>, callback: RCTResponseSenderBlock ) -> Void {
        var error: OTError?
        guard let session = OTRN.sharedState.sessions[sessionId] else {
            let errorInfo = EventUtils.createErrorMessage("Error sending signal. Could not find native session instance")
            callback([errorInfo]);
            return
        }
        if let connectionId = signal["to"] {
            let connection = OTRN.sharedState.connections[connectionId]
            session.signal(withType: signal["type"], string: signal["data"], connection: connection, error: &error)
        } else {
            let connection: OTConnection? = nil
            session.signal(withType: signal["type"], string: signal["data"], connection: connection, error: &error)
        }
        if let err = error {
            dispatchErrorViaCallback(callback, error: err)
        } else {
            callback([NSNull()])
        }
    }

    @objc func setEncryptionSecret(_ sessionId: String, secret: String, callback: @escaping RCTResponseSenderBlock) -> Void {
        var error: OTError?
        guard let session = OTRN.sharedState.sessions[sessionId] else {
            let errorInfo = EventUtils.createErrorMessage("Error setting encryption secret. Could not find native session instance.")
            callback([errorInfo])
            return
        }
        session.setEncryptionSecret(secret, error: &error)
        if let err = error {
            dispatchErrorViaCallback(callback, error: err)
        } else {
            callback([NSNull()])
        }
    }
    
    @objc func destroyPublisher(_ publisherId: String, callback: @escaping RCTResponseSenderBlock) -> Void {
        DispatchQueue.main.async {
            guard let publisher = OTRN.sharedState.publishers[publisherId] else { callback([NSNull()]); return }
            var error: OTError?
            if let isPublishing = OTRN.sharedState.isPublishing[publisherId] {
                if (isPublishing) {
                    if let sessionId = publisher.session?.sessionId {
                        guard let session = OTRN.sharedState.sessions[sessionId] else {
                            let errorInfo = EventUtils.createErrorMessage("Error destroying publisher. Could not find native session instance")
                            callback([errorInfo]);
                            return
                        }
                        if (session.sessionConnectionStatus.rawValue == 1) {
                            session.unpublish(publisher, error: &error)
                        }
                    }
                }
            }
            guard let err = error else {
                OTRN.sharedState.publisherDestroyedCallbacks[publisherId] = callback;
                return
            }
            self.dispatchErrorViaCallback(callback, error: err)
        }
    }
    
    @objc func setAudioTransformers(_ publisherId: String, audioTransformers: Array<Any>) -> Void {
        guard let publisher = OTRN.sharedState.publishers[publisherId] else {
            return // To do -- handle error
        }
        var nativeTransformers: [OTAudioTransformer] = [];

        for transformer in audioTransformers {
            guard let transformerDictionary = transformer as? [String: String] else {
                return // To do -- handle error
            }
            guard let transformerName = transformerDictionary["name"], let transformerProperties = transformerDictionary["properties"] else {
                return // To do -- handle error
            }
            guard let nativeTransformer = OTAudioTransformer(
                name: transformerName,
                properties: transformerProperties
            ) else {
                return // To do -- handle error
            }
            nativeTransformers.append(nativeTransformer)
        }
        publisher.audioTransformers = nativeTransformers
    }

    @objc func setVideoTransformers(_ publisherId: String, videoTransformers: Array<Any>) -> Void {
        guard let publisher = OTRN.sharedState.publishers[publisherId] else {
            return // To do -- handle error
        }
        var nativeTransformers: [OTVideoTransformer] = [];

        for transformer in videoTransformers {
            guard let transformerDictionary = transformer as? [String: String] else {
                return // To do -- handle error
            }
            guard let transformerName = transformerDictionary["name"], let transformerProperties = transformerDictionary["properties"] else {
                return // To do -- handle error
            }
            guard let nativeTransformer = OTVideoTransformer(
                name: transformerName,
                properties: transformerProperties
            ) else {
                return // To do -- handle error
            }
            nativeTransformers.append(nativeTransformer)
        }
        publisher.videoTransformers = nativeTransformers
    }
    
    @objc func removeNativeEvents(_ events: Array<String>) -> Void {
        for event in events {
            if let i = self.jsEvents.index(of: event) {
                self.jsEvents.remove(at: i)
            }
        }
    }
    
    @objc func getSessionInfo(_ sessionId: String, callback: RCTResponseSenderBlock) -> Void {
        guard let session = OTRN.sharedState.sessions[sessionId] else { callback([NSNull()]); return }
        var sessionInfo: Dictionary<String, Any> = EventUtils.prepareJSSessionEventData(session);
        sessionInfo["connectionStatus"] = session.sessionConnectionStatus.rawValue;
        callback([sessionInfo]);
    }
    
    @objc func getSessionCapabilities(_ sessionId: String, callback: RCTResponseSenderBlock) -> Void{
        guard let session = OTRN.sharedState.sessions[sessionId] else { callback([NSNull()]); return }
        var sessionCapabilities: Dictionary<String, Any> = [:];
        sessionCapabilities["canPublish"] = session.capabilities?.canPublish;
        // Bug in OT iOS SDK. This is set to false, but it should be true:
        sessionCapabilities["canSubscribe"] = true;
        sessionCapabilities["canForceMute"] = session.capabilities?.canForceMute;
        callback([sessionCapabilities]);
    }
    
    @objc func reportIssue(_ sessionId: String, callback: RCTResponseSenderBlock) -> Void{
        guard let session = OTRN.sharedState.sessions[sessionId] else { callback([NSNull()]); return }
        var issueId:NSString? = ""
        session.reportIssue(&issueId)
        callback([issueId! as NSString])
    }
    
    // The Vonage Video iOS SDK does not implement a getVideoCodecs method, because iOS
    // supported all supported codecs. But we will implement it here so that the
    // OT.getVideoCodecs() method can be called cross-platform.
    @objc func getSupportedCodecs(_ resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) -> Void{
        var supportedCodecs: Dictionary<String, Any> = [:];
        supportedCodecs["videoDecoderCodecs"] = ["H.264", "VP8"];
        supportedCodecs["videoEncoderCodecs"] = ["H.264", "VP8"];
        resolve(supportedCodecs)
    }
    
    @objc func forceMuteAll(_ sessionId: String, excludedStreamIds: Array<String>, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) -> Void{
        guard let session = OTRN.sharedState.sessions[sessionId] else {
            reject("event_failure", "Session ID not found", nil)
            return
        }
        var excludedStreams:[OTStream] = []
        for streamId in excludedStreamIds {
            guard let stream = OTRN.sharedState.subscriberStreams[streamId] ?? OTRN.sharedState.publisherStreams[streamId] else {
                continue // Ignore bogus stream IDs
            }
            excludedStreams.append(stream)
        }
        var error: OTError?
        session.forceMuteAll(excludedStreams, error: &error)
        if let error = error {
          reject("event_failure", error.localizedDescription, nil)
          return
        }
        return resolve(true)
    }

    @objc func forceMuteStream(_ sessionId: String, streamId: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) -> Void{
        guard let session = OTRN.sharedState.sessions[sessionId] else { 
            reject("event_failure", "Session ID not found", nil);
            return
        }
        guard let stream = OTRN.sharedState.subscriberStreams[streamId] else {
            reject("event_failure", "Stream ID not found", nil);
            return
        }
        var error: OTError?
        session.forceMuteStream(stream, error: &error)
        if let error = error {
          reject("event_failure", error.localizedDescription, nil);
          return;
        }
        resolve(true);
    }

    @objc func disableForceMute(_ sessionId: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) -> Void{
        guard let session = OTRN.sharedState.sessions[sessionId] else {
            reject("event_failure", "Session not found.", nil);
            return
            }
        var error: OTError?
        session.disableForceMute(&error)
        if let error = error {
          reject("event_failure", error.localizedDescription, nil);
          return;
        }
        resolve(true);
    }
    
    @objc func enableLogs(_ logLevel: Bool) -> Void {
        self.logLevel = logLevel;
    }
    
    func resetPublisher(_ publisherId: String, publisher: OTPublisher) -> Void {
        publisher.view?.removeFromSuperview()
        OTRN.sharedState.isPublishing[publisherId] = false;
    }
    
    func removeStream(_ streamId: String) -> Void {
        OTRN.sharedState.subscribers.removeValue(forKey: streamId)
        OTRN.sharedState.subscriberStreams.removeValue(forKey: streamId)
    }
    
    func emitEvent(_ event: String, data: Any) -> Void {
        if (self.bridge != nil && (self.jsEvents.contains(event) || self.componentEvents.contains(event))) {
           self.sendEvent(withName: event, body: data);
        }
    }
    
    func checkAndEmitStreamPropertyChangeEvent(_ streamId: String, changedProperty: String, oldValue: Any, newValue: Any, isPublisherStream: Bool) {
        guard let stream = isPublisherStream ? OTRN.sharedState.publisherStreams[streamId] : OTRN.sharedState.subscriberStreams[streamId] else { return }
        let streamInfo: Dictionary<String, Any> = EventUtils.prepareJSStreamEventData(stream);
        let eventData: Dictionary<String, Any> = EventUtils.prepareStreamPropertyChangedEventData(changedProperty, oldValue: oldValue, newValue: newValue, stream: streamInfo);
        self.emitEvent("\(stream.session.sessionId):\(EventUtils.sessionPreface)streamPropertyChanged", data: eventData)
    }
    
    func dispatchErrorViaCallback(_ callback: RCTResponseSenderBlock, error: OTError) {
        let errorInfo = EventUtils.prepareJSErrorEventData(error);
        callback([errorInfo]);
    }
    
    func setStreamObservers(stream: OTStream, isPublisherStream: Bool) {
        let hasVideoObservation: NSKeyValueObservation = stream.observe(\.hasVideo, options: [.old, .new]) { object, change in
            guard let oldValue = change.oldValue else { return }
            guard let newValue = change.newValue else { return }
            self.checkAndEmitStreamPropertyChangeEvent(stream.streamId, changedProperty: "hasVideo", oldValue: oldValue, newValue: newValue, isPublisherStream: isPublisherStream)
        }
        let hasAudioObservation: NSKeyValueObservation = stream.observe(\.hasAudio, options: [.old, .new]) { object, change in
            guard let oldValue = change.oldValue else { return }
            guard let newValue = change.newValue else { return }
            self.checkAndEmitStreamPropertyChangeEvent(stream.streamId, changedProperty: "hasAudio", oldValue: oldValue, newValue: newValue, isPublisherStream: isPublisherStream)
        }
        let videoDimensionsObservation: NSKeyValueObservation = stream.observe(\.videoDimensions, options: [.old, .new]) { object, change in
            guard let oldValue = change.oldValue else { return }
            guard let newValue = change.newValue else { return }
            self.checkAndEmitStreamPropertyChangeEvent(stream.streamId, changedProperty: "videoDimensions", oldValue: oldValue, newValue: newValue, isPublisherStream: isPublisherStream)
        }
        let videoTypeObservation: NSKeyValueObservation = stream.observe(\.videoType, options: [.old, .new]) { object, change in
            guard let oldValue = change.oldValue else { return }
            guard let newValue = change.newValue else { return }
            self.checkAndEmitStreamPropertyChangeEvent(stream.streamId, changedProperty: "videoType", oldValue: oldValue, newValue: newValue, isPublisherStream: isPublisherStream)
        }
        OTRN.sharedState.streamObservers.updateValue([hasAudioObservation, hasVideoObservation, videoDimensionsObservation, videoTypeObservation], forKey: stream.streamId)
    }
    
    func printLogs(_ message: String) {
        if (logLevel) {
            print(message)
        }
    }
}

extension OTSessionManager: OTSessionDelegate {
    func sessionDidConnect(_ session: OTSession) {
        guard let callback = OTRN.sharedState.sessionConnectCallbacks[session.sessionId] else { return }
        callback([NSNull()])
        let sessionInfo = EventUtils.prepareJSSessionEventData(session);
        self.emitEvent("\(session.sessionId):\(EventUtils.sessionPreface)sessionDidConnect", data: sessionInfo);
        printLogs("OTRN: Session connected")
    }
    
    func sessionDidDisconnect(_ session: OTSession) {
        let sessionInfo = EventUtils.prepareJSSessionEventData(session);
        self.emitEvent("\(session.sessionId):\(EventUtils.sessionPreface)sessionDidDisconnect", data: sessionInfo);
        guard let callback = OTRN.sharedState.sessionDisconnectCallbacks[session.sessionId] else { return }
        callback([NSNull()]);
        session.delegate = nil;
        OTRN.sharedState.sessions.removeValue(forKey: session.sessionId);
        OTRN.sharedState.sessionDisconnectCallbacks.removeValue(forKey: session.sessionId);
        OTRN.sharedState.sessionConnectCallbacks.removeValue(forKey: session.sessionId);
        printLogs("OTRN: Session disconnected")
    }
    
    func session(_ session: OTSession, connectionCreated connection: OTConnection) {
        OTRN.sharedState.connections.updateValue(connection, forKey: connection.connectionId)
        var connectionInfo = EventUtils.prepareJSConnectionEventData(connection);
        connectionInfo["sessionId"] = session.sessionId;
        self.emitEvent("\(session.sessionId):\(EventUtils.sessionPreface)connectionCreated", data: connectionInfo)
        printLogs("OTRN Session: A connection was created \(connection.connectionId)")
    }
    func session(_ session: OTSession, connectionDestroyed connection: OTConnection) {
        OTRN.sharedState.connections.removeValue(forKey: connection.connectionId)
        var connectionInfo = EventUtils.prepareJSConnectionEventData(connection);
        connectionInfo["sessionId"] = session.sessionId;
        self.emitEvent("\(session.sessionId):\(EventUtils.sessionPreface)connectionDestroyed", data: connectionInfo)
        printLogs("OTRN Session: A connection was destroyed")
    }
    
    func session(_ session: OTSession, archiveStartedWithId archiveId: String, name: String?) {
        var archiveInfo: Dictionary<String, String> = [:];
        archiveInfo["archiveId"] = archiveId;
        archiveInfo["name"] = name;
        archiveInfo["sessionId"] = session.sessionId;
        self.emitEvent("\(session.sessionId):\(EventUtils.sessionPreface)archiveStartedWithId", data: archiveInfo)
        printLogs("OTRN Session: Archive started with \(archiveId)")
    }
    
    func session(_ session: OTSession, archiveStoppedWithId archiveId: String) {
        var archiveInfo: Dictionary<String, String> = [:];
        archiveInfo["archiveId"] = archiveId;
        archiveInfo["name"] = "";
        archiveInfo["sessionId"] = session.sessionId;
        self.emitEvent("\(session.sessionId):\(EventUtils.sessionPreface)archiveStoppedWithId", data: archiveInfo);
        printLogs("OTRN Session: Archive stopped with \(archiveId)")
    }
    
    func sessionDidBeginReconnecting(_ session: OTSession) {
        let sessionInfo = EventUtils.prepareJSSessionEventData(session);
        self.emitEvent("\(session.sessionId):\(EventUtils.sessionPreface)sessionDidBeginReconnecting", data: sessionInfo)
        printLogs("OTRN Session: Session did begin reconnecting")
    }
    
    func sessionDidReconnect(_ session: OTSession) {
        let sessionInfo = EventUtils.prepareJSSessionEventData(session);
        self.emitEvent("\(session.sessionId):\(EventUtils.sessionPreface)sessionDidReconnect", data: sessionInfo)
        printLogs("OTRN Session: Session reconnected")
    }
    
    func session(_ session: OTSession, streamCreated stream: OTStream) {
        OTRN.sharedState.subscriberStreams.updateValue(stream, forKey: stream.streamId)
        let streamInfo: Dictionary<String, Any> = EventUtils.prepareJSStreamEventData(stream)
        self.emitEvent("\(session.sessionId):\(EventUtils.sessionPreface)streamCreated", data: streamInfo)
        setStreamObservers(stream: stream, isPublisherStream: false)
        printLogs("OTRN: Session streamCreated \(stream.streamId)")
    }
    
    func session(_ session: OTSession, streamDestroyed stream: OTStream) {
        let streamInfo: Dictionary<String, Any> = EventUtils.prepareJSStreamEventData(stream);
        self.emitEvent("\(session.sessionId):\(EventUtils.sessionPreface)streamDestroyed", data: streamInfo)
        printLogs("OTRN: Session streamDestroyed: \(stream.streamId)")
    }
    
    func session(_ session: OTSession, didFailWithError error: OTError) {
        let errorInfo: Dictionary<String, Any> = EventUtils.prepareJSErrorEventData(error);
        self.emitEvent("\(session.sessionId):\(EventUtils.sessionPreface)didFailWithError", data: errorInfo)
        printLogs("OTRN: Session Failed to connect: \(error.localizedDescription)")
    }
    
    func session(_ session: OTSession, receivedSignalType type: String?, from connection: OTConnection?, with string: String?) {
        var signalData: Dictionary<String, Any> = [:];
        signalData["type"] = type;
        signalData["data"] = string;
        signalData["connectionId"] = connection?.connectionId;
        signalData["sessionId"] = session.sessionId;
        self.emitEvent("\(session.sessionId):\(EventUtils.sessionPreface)signal", data: signalData)
        printLogs("OTRN: Session signal received")
    }

    func session(_ session: OTSession, info muteForced: OTMuteForcedInfo) {
        var muteForcedInfo: Dictionary<String, Any> = [:];
        muteForcedInfo["active"] = muteForced.active;
        self.emitEvent("\(session.sessionId):\(EventUtils.sessionPreface)muteForced", data: muteForcedInfo)
        printLogs("OTRN Session: Session muteForced - active:  \(muteForced.active)")
    }
}

extension OTSessionManager: OTPublisherDelegate {
    func publisher(_ publisher: OTPublisherKit, streamCreated stream: OTStream) {
        OTRN.sharedState.publisherStreams.updateValue(stream, forKey: stream.streamId)
        OTRN.sharedState.subscriberStreams.updateValue(stream, forKey: stream.streamId)
        let publisherId = Utils.getPublisherId(publisher as! OTPublisher);
        if (publisherId.count > 0) {
            OTRN.sharedState.isPublishing[publisherId] = true;
            var streamInfo: Dictionary<String, Any> = EventUtils.prepareJSStreamEventData(stream);
            streamInfo["publisherId"] = publisherId;
            self.emitEvent("publisherStreamCreated", data: streamInfo);
            setStreamObservers(stream: stream, isPublisherStream: true)
        }
        printLogs("OTRN: Publisher Stream created")
    }
    
    func publisher(_ publisher: OTPublisherKit, streamDestroyed stream: OTStream) {
        OTRN.sharedState.streamObservers.removeValue(forKey: stream.streamId)
        OTRN.sharedState.publisherStreams.removeValue(forKey: stream.streamId)
        OTRN.sharedState.subscriberStreams.removeValue(forKey: stream.streamId)
        let publisherId = Utils.getPublisherId(publisher as! OTPublisher);
        OTRN.sharedState.isPublishing[publisherId] = false;
        if (publisherId.count > 0) {
            OTRN.sharedState.isPublishing[publisherId] = false;
            var streamInfo: Dictionary<String, Any> = EventUtils.prepareJSStreamEventData(stream);
            streamInfo["publisherId"] = publisherId;
            self.emitEvent("publisherStreamDestroyed", data: streamInfo);
        }
        OTRN.sharedState.publishers[publisherId] = nil;
        OTRN.sharedState.isPublishing[publisherId] = nil;
        guard let callback = OTRN.sharedState.publisherDestroyedCallbacks[publisherId] else {
            printLogs("OTRN: Publisher Stream destroyed")
            return
        };
        callback([NSNull()]);
        printLogs("OTRN: Publisher Stream destroyed")
    }
    
    func publisher(_ publisher: OTPublisherKit, didFailWithError error: OTError) {
        let publisherId = Utils.getPublisherId(publisher as! OTPublisher);
        if (publisherId.count > 0) {
            let errorInfo: Dictionary<String, Any> = EventUtils.prepareJSErrorEventData(error);
            self.emitEvent("\(publisherId):\(EventUtils.publisherPreface)didFailWithError", data: errorInfo)
        }
        printLogs("OTRN: Publisher failed: \(error.localizedDescription)")
    }

    func muteForced(_ publisher: OTPublisherKit) {
        let publisherId = Utils.getPublisherId(publisher as! OTPublisher);
        if (publisherId.count > 0) {
            self.emitEvent("\(publisherId):\(EventUtils.publisherPreface)muteForced", data: [NSNull()]);
        }
        printLogs("OTRN: Publisher mute forced")
    }

    func videoDisableWarning(_ publisher: OTPublisherKit) {
        let publisherId = Utils.getPublisherId(publisher as! OTPublisher)
        if (publisherId.count > 0) {
            self.emitEvent("\(publisherId):\(EventUtils.publisherPreface)videoDisableWarning", data: [NSNull()])
        }
        printLogs("OTRN: Publisher videoDisableWarning")
    }

    func videoDisableWarningLifted(_ publisher: OTPublisherKit) {
        let publisherId = Utils.getPublisherId(publisher as! OTPublisher);
        if (publisherId.count > 0) {
            self.emitEvent("\(publisherId):\(EventUtils.publisherPreface)videoDisableWarningLifted", data: [NSNull()])
        }
        printLogs("OTRN: Publisher videoDisableWarningLifted")
    }

    func videoDisabled(_ publisher: OTPublisherKit, reason: OTPublisherVideoEventReason) {
        var publisherInfo: Dictionary<String, Any> = [:]
        publisherInfo["reason"] = Utils.convertOTPublisherVideoEventReasonToString(reason)
        let publisherId = Utils.getPublisherId(publisher as! OTPublisher)
        if (publisherId.count > 0) {
            self.emitEvent("\(publisherId):\(EventUtils.publisherPreface)videoDisabled", data: publisherInfo)
        }
        printLogs("OTRN: Publisher videoDisabled")
    }

    func videoEnabled(_ publisher: OTPublisherKit, reason: OTPublisherVideoEventReason) {
        var publisherInfo: Dictionary<String, Any> = [:]
        publisherInfo["reason"] = Utils.convertOTPublisherVideoEventReasonToString(reason)
        let publisherId = Utils.getPublisherId(publisher as! OTPublisher)
        if (publisherId.count > 0) {
            self.emitEvent("\(publisherId):\(EventUtils.publisherPreface)videoEnabled", data: publisherInfo)
        }
        printLogs("OTRN: Publisher videoEnabled")
    }
}

extension OTSessionManager: OTPublisherKitAudioLevelDelegate {
    func publisher(_ publisher: OTPublisherKit, audioLevelUpdated audioLevel: Float) {
        let publisherId = Utils.getPublisherId(publisher as! OTPublisher);
        if (publisherId.count > 0) {
            self.emitEvent("\(publisherId):\(EventUtils.publisherPreface)audioLevelUpdated", data: audioLevel)
        }
    }
}

extension OTSessionManager: OTPublisherKitRtcStatsReportDelegate {
    func publisher(_ publisher: OTPublisherKit, rtcStatsReport stats: [OTPublisherRtcStats]) {
        let publisherId = Utils.getPublisherId(publisher as! OTPublisher);
        if (publisherId.count > 0) {
            let statsArray: [Dictionary<String, Any>] = EventUtils.preparePublisherRtcStats(stats);
            self.emitEvent("\(publisherId):\(EventUtils.publisherPreface)rtcStatsReport", data: statsArray)
        }
    }
}

extension OTSessionManager: OTPublisherKitNetworkStatsDelegate {
    func publisher(_ publisher: OTPublisherKit, audioNetworkStatsUpdated stats: [OTPublisherKitAudioNetworkStats]) {
        let publisherId = Utils.getPublisherId(publisher as! OTPublisher);
        if (publisherId.count > 0) {
            let statsArray: [Dictionary<String, Any>] = EventUtils.preparePublisherAudioNetworkStats(stats);
            self.emitEvent("\(publisherId):\(EventUtils.publisherPreface)audioNetworkStatsUpdated", data: statsArray)
        }
    }

    func publisher(_ publisher: OTPublisherKit, videoNetworkStatsUpdated stats: [OTPublisherKitVideoNetworkStats]) {
        let publisherId = Utils.getPublisherId(publisher as! OTPublisher);
        if (publisherId.count > 0) {
            let statsArray: [Dictionary<String, Any>] = EventUtils.preparePublisherVideoNetworkStats(stats);
            self.emitEvent("\(publisherId):\(EventUtils.publisherPreface)videoNetworkStatsUpdated", data: statsArray)
        }
    }
}

extension OTSessionManager: OTSubscriberDelegate {
    func subscriberDidConnect(toStream subscriberKit: OTSubscriberKit) {
        if let stream = subscriberKit.stream {
            let streamInfo: Dictionary<String, Any> = EventUtils.prepareJSStreamEventData(stream);
            self.emitEvent("\(EventUtils.subscriberPreface)subscriberDidConnect", data: streamInfo);
        } else {
            self.emitEvent("\(EventUtils.subscriberPreface)subscriberDidConnect", data: [NSNull()]);
        }
        printLogs("OTRN: Subscriber connected")
    }
    
    func subscriber(_ subscriber: OTSubscriberKit, didFailWithError error: OTError) {
        var subscriberInfo: Dictionary<String, Any> = [:];
        subscriberInfo["error"] = EventUtils.prepareJSErrorEventData(error);
        guard let stream = subscriber.stream else {
            self.emitEvent("\(EventUtils.subscriberPreface)didFailWithError", data: subscriberInfo)
            return;
        }
        subscriberInfo["stream"] = EventUtils.prepareJSStreamEventData(stream);
        self.emitEvent("\(EventUtils.subscriberPreface)didFailWithError", data: subscriberInfo)
        printLogs("OTRN: Subscriber failed: \(error.localizedDescription)")
    }
}

extension OTSessionManager: OTSubscriberKitNetworkStatsDelegate {
    func subscriber(_ subscriber: OTSubscriberKit, videoNetworkStatsUpdated stats: OTSubscriberKitVideoNetworkStats) {
        var subscriberInfo: Dictionary<String, Any> = [:];
        subscriberInfo["videoStats"] = EventUtils.prepareSubscriberVideoNetworkStatsEventData(stats);
        guard let stream = subscriber.stream else {
            self.emitEvent("\(EventUtils.subscriberPreface)videoNetworkStatsUpdated", data: subscriberInfo);
            return;
        }
        subscriberInfo["stream"] = EventUtils.prepareJSStreamEventData(stream);
        self.emitEvent("\(EventUtils.subscriberPreface)videoNetworkStatsUpdated", data: subscriberInfo);
    }
    
    func subscriber(_ subscriber: OTSubscriberKit, audioNetworkStatsUpdated stats: OTSubscriberKitAudioNetworkStats) {
        var subscriberInfo: Dictionary<String, Any> = [:];
        subscriberInfo["audioStats"] = EventUtils.prepareSubscriberAudioNetworkStatsEventData(stats);
        guard let stream = subscriber.stream else {
            self.emitEvent("\(EventUtils.subscriberPreface)audioNetworkStatsUpdated", data: subscriberInfo);
            return
        }
        subscriberInfo["stream"] = EventUtils.prepareJSStreamEventData(stream);
        self.emitEvent("\(EventUtils.subscriberPreface)audioNetworkStatsUpdated", data: subscriberInfo);
    }
    
    func subscriberVideoEnabled(_ subscriber: OTSubscriberKit, reason: OTSubscriberVideoEventReason) {
        var subscriberInfo: Dictionary<String, Any> = [:];
        subscriberInfo["reason"] = Utils.convertOTSubscriberVideoEventReasonToString(reason);
        guard let stream = subscriber.stream else {
            self.emitEvent("\(EventUtils.subscriberPreface)subscriberVideoEnabled", data: subscriberInfo);
            return;
        }
        subscriberInfo["stream"] = EventUtils.prepareJSStreamEventData(stream);
        self.emitEvent("\(EventUtils.subscriberPreface)subscriberVideoEnabled", data: subscriberInfo);
        printLogs("OTRN: subscriberVideoEnabled")
    }
    
    func subscriberVideoDisabled(_ subscriber: OTSubscriberKit, reason: OTSubscriberVideoEventReason) {
        var subscriberInfo: Dictionary<String, Any> = [:];
        subscriberInfo["reason"] = Utils.convertOTSubscriberVideoEventReasonToString(reason);
        guard let stream = subscriber.stream else {
            self.emitEvent("\(EventUtils.subscriberPreface)subscriberVideoDisabled", data: subscriberInfo);
            return;
        }
        subscriberInfo["stream"] = EventUtils.prepareJSStreamEventData(stream);
        self.emitEvent("\(EventUtils.subscriberPreface)subscriberVideoDisabled", data: subscriberInfo);
        printLogs("OTRN: subscriberVideoDisabled")
    }
    
    func subscriberVideoDisableWarning(_ subscriber: OTSubscriberKit) {
        var subscriberInfo: Dictionary<String, Any> = [:];
        guard let stream = subscriber.stream else {
            self.emitEvent("\(EventUtils.subscriberPreface)subscriberVideoDisableWarning", data: subscriberInfo);
            return;
        }
        subscriberInfo["stream"] = EventUtils.prepareJSStreamEventData(stream);
        self.emitEvent("\(EventUtils.subscriberPreface)subscriberVideoDisableWarning", data: subscriberInfo);
        printLogs("OTRN: subscriberVideoDisableWarning")
    }
    
    func subscriberVideoDisableWarningLifted(_ subscriber: OTSubscriberKit) {
        var subscriberInfo: Dictionary<String, Any> = [:];
        guard let stream = subscriber.stream else {
            self.emitEvent("\(EventUtils.subscriberPreface)subscriberVideoDisableWarningLifted", data: subscriberInfo);
            return;
        }
        subscriberInfo["stream"] = EventUtils.prepareJSStreamEventData(stream);
        self.emitEvent("\(EventUtils.subscriberPreface)subscriberVideoDisableWarningLifted", data: subscriberInfo);
        printLogs("OTRN: subscriberVideoDisableWarningLifted")
    }
    
    func subscriberVideoDataReceived(_ subscriber: OTSubscriber) {
        var subscriberInfo: Dictionary<String, Any> = [:];
        guard let stream = subscriber.stream else {
            self.emitEvent("\(EventUtils.subscriberPreface)subscriberVideoDataReceived", data: subscriberInfo);
            return
        }
        subscriberInfo["stream"] = EventUtils.prepareJSStreamEventData(stream);
        self.emitEvent("\(EventUtils.subscriberPreface)subscriberVideoDataReceived", data: subscriberInfo);
    }
    
    func subscriberDidReconnect(toStream subscriber: OTSubscriberKit) {
        var subscriberInfo: Dictionary<String, Any> = [:];
        guard let stream = subscriber.stream else {
            self.emitEvent("\(EventUtils.subscriberPreface)subscriberDidReconnect", data: subscriberInfo);
            printLogs("OTRN: subscriberDidReconnect")
            return;
        };
        subscriberInfo["stream"] = EventUtils.prepareJSStreamEventData(stream);
        self.emitEvent("\(EventUtils.subscriberPreface)subscriberDidReconnect", data: subscriberInfo);
        printLogs("OTRN: subscriberDidReconnect")
    }
    
    func subscriberDidDisconnect(fromStream subscriberKit: OTSubscriberKit) {
        var subscriberInfo: Dictionary<String, Any> = [:];
        guard let stream = subscriberKit.stream else {
            self.emitEvent("\(EventUtils.subscriberPreface)subscriberDidDisconnect", data: subscriberInfo);
            printLogs("OTRN: subscriberDidDisconnect")
            return;
        };
        subscriberInfo["stream"] = EventUtils.prepareJSStreamEventData(stream);
        self.emitEvent("\(EventUtils.subscriberPreface)subscriberDidDisconnect", data: subscriberInfo);
        printLogs("OTRN: Subscriber disconnected")
    }
    
}

extension OTSessionManager: OTSubscriberKitAudioLevelDelegate {
    func subscriber(_ subscriber: OTSubscriberKit, audioLevelUpdated audioLevel: Float) {
        var subscriberInfo: Dictionary<String, Any> = [:];
        subscriberInfo["audioLevel"] = audioLevel;
        guard let stream = subscriber.stream else {
            self.emitEvent("\(EventUtils.subscriberPreface)audioLevelUpdated", data: subscriberInfo);
            return;
        }
        subscriberInfo["stream"] = EventUtils.prepareJSStreamEventData(stream);
        self.emitEvent("\(EventUtils.subscriberPreface)audioLevelUpdated", data: subscriberInfo);
    }
}

extension OTSessionManager: OTSubscriberKitRtcStatsReportDelegate {
    func subscriber(_ subscriber: OTSubscriberKit, rtcStatsReport stats: String) {
        var subscriberInfo: Dictionary<String, Any> = [:];
        subscriberInfo["jsonArrayOfReports"] = stats;
        guard let stream = subscriber.stream else {
            self.emitEvent("\(EventUtils.subscriberPreface)rtcStatsReport", data: subscriberInfo);
            return;
        }
        subscriberInfo["stream"] = EventUtils.prepareJSStreamEventData(stream);
        self.emitEvent("\(EventUtils.subscriberPreface)rtcStatsReport", data: subscriberInfo)
    }
}

extension OTSessionManager: OTSubscriberKitCaptionsDelegate {
    func subscriber(_ subscriber: OTSubscriberKit, caption text: String, isFinal isFinal: Bool) {
        var subscriberInfo: Dictionary<String, Any> = [:];
        subscriberInfo["text"] = text;
        subscriberInfo["isFinal"] = isFinal;
        guard let stream = subscriber.stream else {
            self.emitEvent("\(EventUtils.subscriberPreface)subscriberCaptionReceived", data: subscriberInfo);
            return;
        }
        subscriberInfo["stream"] = EventUtils.prepareJSStreamEventData(stream);
        self.emitEvent("\(EventUtils.subscriberPreface)subscriberCaptionReceived", data: subscriberInfo);
    }
}
