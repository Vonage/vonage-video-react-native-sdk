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

/// A minimal thread-safe dictionary.
///
/// `OTRN.sharedState` is read from the React TurboModule background queue (e.g.
/// `publish`/`unpublish`/`removeSubscriber`) while it is written from the main
/// thread by OTSession/OTPublisherKit/OTSubscriberKit delegate callbacks and
/// Fabric component-view lifecycle. Swift's `Dictionary` is not thread-safe, so
/// a concurrent read racing a write can dereference freed storage and crash with
/// `EXC_BAD_ACCESS` (use-after-free) — see opentok-react-native#811.
///
/// All access is serialized through a private concurrent queue: reads run
/// concurrently via `sync`, mutations run exclusively via a `.barrier` block, so
/// every per-key operation is atomic and the backing storage is never read while
/// it is being mutated on another thread. The queue is private and non-reentrant,
/// so `sync` from the main thread cannot deadlock.
final class AtomicDictionary<Key: Hashable, Value> {
  private var storage: [Key: Value]
  private let queue = DispatchQueue(
    label: "com.opentokreactnative.atomicdictionary",
    attributes: .concurrent)

  init(_ storage: [Key: Value] = [:]) {
    self.storage = storage
  }

  subscript(key: Key) -> Value? {
    get { queue.sync { storage[key] } }
    set { queue.sync(flags: .barrier) { storage[key] = newValue } }
  }

  @discardableResult
  func updateValue(_ value: Value, forKey key: Key) -> Value? {
    queue.sync(flags: .barrier) { storage.updateValue(value, forKey: key) }
  }

  @discardableResult
  func removeValue(forKey key: Key) -> Value? {
    queue.sync(flags: .barrier) { storage.removeValue(forKey: key) }
  }

  func removeAll() {
    queue.sync(flags: .barrier) { storage.removeAll() }
  }

  /// An atomic point-in-time copy, for iterating/filtering without holding the
  /// lock across the caller's work (and without racing concurrent mutations).
  var snapshot: [Key: Value] {
    queue.sync { storage }
  }
}

class OTRN : NSObject {
  static let sharedState = OTRN()
  var opentokModule: OpentokReactNative?
  let sessions = AtomicDictionary<String, OTSession>()
  let subscriberStreams = AtomicDictionary<String, OTStream>()
  let subscribers = AtomicDictionary<String, OTSubscriber>()
  let publishers = AtomicDictionary<String, OTPublisher>()
  let publisherStreams = AtomicDictionary<String, OTStream>()
  let publisherDestroyedCallbacks = AtomicDictionary<String, RCTResponseSenderBlock>()
  let sessionConnectCallbacks = AtomicDictionary<String, RCTResponseSenderBlock>()
  let sessionDisconnectCallbacks = AtomicDictionary<String, RCTResponseSenderBlock>()
  let isPublishing = AtomicDictionary<String, Bool>()
  let streamObservers = AtomicDictionary<String, [NSKeyValueObservation]>()
  let connections = AtomicDictionary<String, OTConnection>()
  let sessionDelegateHandlers = AtomicDictionary<String, AnyObject>()
  override init() {
    super.init()
  }
}
