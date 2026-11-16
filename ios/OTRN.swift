//
//  OTRN.swift
//  OpenTokReactNative
//
//  Created by Manik Sachdeva on 1/16/18.
//  Copyright © 2018 Facebook. All rights reserved.
//

import Foundation
import OpenTok
import React

class OTRN : NSObject {
  static let sharedState = OTRN()
  var opentokModule: OpentokReactNative?
  var sessions = [String: OTSession]()
  var subscriberStreams = [String: OTStream]()
  var subscribers = [String: OTSubscriber]()
  var publishers = [String: OTPublisher]()
  var publisherStreams = [String: OTStream]()
  var publisherDestroyedCallbacks = [String: RCTResponseSenderBlock]()
  var sessionConnectCallbacks = [String: (resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock)]()
  var sessionDisconnectCallbacks = [String: (resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock)]()
  var isPublishing = [String: Bool]()
  var streamObservers = [String: [NSKeyValueObservation]]()
  var connections = [String: OTConnection]()
  var sessionDelegateHandlers = [String: AnyObject]()
  private let pendingPublishLock = NSLock()
  private var pendingPublishes = [String: String]()

  override init() {
    super.init()
  }

  /// Publishes right away when the native publisher exists. Otherwise the request is kept until the
  /// publisher view creates the publisher (see `registerPublisher`), instead of being silently dropped.
  func requestPublish(sessionId: String, publisherId: String) {
    pendingPublishLock.lock()
    guard publishers[publisherId] != nil else {
      pendingPublishes[publisherId] = sessionId
      pendingPublishLock.unlock()
      return
    }
    pendingPublishLock.unlock()
    publishNow(sessionId: sessionId, publisherId: publisherId)
  }

  /// Makes the publisher visible to `requestPublish` only once it is fully configured, and runs a
  /// publish request that arrived before that. Store and lookup share the lock so none is missed.
  func registerPublisher(_ publisher: OTPublisher, publisherId: String) {
    pendingPublishLock.lock()
    publishers[publisherId] = publisher
    let sessionId = pendingPublishes.removeValue(forKey: publisherId)
    pendingPublishLock.unlock()
    if let sessionId = sessionId {
      publishNow(sessionId: sessionId, publisherId: publisherId)
    }
  }

  func cancelPendingPublish(publisherId: String) {
    pendingPublishLock.lock()
    pendingPublishes.removeValue(forKey: publisherId)
    pendingPublishLock.unlock()
  }

  private func publishNow(sessionId: String, publisherId: String) {
    guard let publisher = publishers[publisherId],
      let session = sessions[sessionId]
    else {
      return
    }
    var error: OTError?
    session.publish(publisher, error: &error)
  }
}
