//
//  OpentokReactNativeSwift-Swift.h
//
//  Hand-authored Objective-C interface for the Swift @objc public classes in
//  the OpentokReactNativeSwift SPM target.
//
//  WHY THIS EXISTS: Swift Package Manager does not expose a Swift target's
//  auto-generated "<Module>-Swift.h" to an Objective-C++ target in the SAME
//  package (the generated header lives under $OBJROOT/GeneratedModuleMaps and
//  is not added to the ObjC++ target's header search path; `@import` requires
//  C++ modules which breaks the React headers). The canonical workaround
//  (Swift Forums) is to hand-author the ObjC declarations of the @objc public
//  Swift API and import that instead of the generated header. Under CocoaPods
//  the .mm files still resolve the real generated header via their
//  __has_include(<OpentokReactNative/OpentokReactNative-Swift.h>) branch, so
//  this file is only used on the SPM path.
//
//  MUST be kept in sync with the @objc public signatures in
//  OpentokReactNative.swift, OTRNPublisherComponentView.swift and
//  OTRNSubscriberComponentView.swift.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <React/RCTBridgeModule.h>

// Forward declarations only — importing the concrete ObjC headers here would
// clash with the class extensions the .mm files redeclare (e.g.
// OpentokReactNative is redeclared in OpentokReactNative.mm with a different
// superclass). Pointers to these types only need a forward declaration.
@class OpentokReactNative;
@class OTRNPublisherComponentView;
@class OTRNSubscriberComponentView;

NS_ASSUME_NONNULL_BEGIN

/// Mirrors OpentokReactNativeImpl (OpentokReactNative.swift).
@interface OpentokReactNativeImpl : NSObject
- (instancetype)initWithOt:(OpentokReactNative *)ot;
- (void)initSession:(NSString *)apiKey
          sessionId:(NSString *)sessionId
     sessionOptions:(NSDictionary<NSString *, id> *)sessionOptions;
- (void)connect:(NSString *)sessionId
          token:(NSString *)token
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject;
- (void)disconnect:(NSString *)sessionId
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject;
- (void)sendSignal:(NSString *)sessionId
            signal:(NSDictionary<NSString *, NSString *> *)signal
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject;
- (void)setEncryptionSecret:(NSString *)sessionId
                     secret:(NSString *)secret
                    resolve:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject;
- (void)getCapabilities:(NSString *)sessionId
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject;
- (void)reportIssue:(NSString *)sessionId
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject;
- (void)publish:(NSString *)sessionId publisherId:(NSString *)publisherId;
- (void)unpublish:(NSString *)sessionId publisherId:(NSString *)publisherId;
- (void)removeSubscriber:(NSString *)sessionId streamId:(NSString *)streamId;
- (void)forceMuteAll:(NSString *)sessionId
   excludedStreamIds:(NSArray<NSString *> *)excludedStreamIds
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject;
- (void)forceMuteStream:(NSString *)sessionId
               streamId:(NSString *)streamId
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject;
- (void)forceDisconnect:(NSString *)sessionId
           connectionId:(NSString *)connectionId
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject;
- (void)disableForceMute:(NSString *)sessionId
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject;
- (void)getPublisherRtcStatsReport:(NSString *)sessionId
                       publisherId:(NSString *)publisherId;
- (void)getSubscriberRtcStatsReport:(NSString *)sessionId;
- (void)setAudioTransformers:(NSString *)sessionId
                 publisherId:(NSString *)publisherId
                transformers:(NSArray *)transformers;
- (void)setVideoTransformers:(NSString *)sessionId
                 publisherId:(NSString *)publisherId
                transformers:(NSArray *)transformers;
@end

/// Mirrors OTRNPublisherImpl (OTRNPublisherComponentView.swift).
@interface OTRNPublisherImpl : NSObject
@property (nonatomic, readonly) UIView *publisherView;
- (instancetype)initWithView:(OTRNPublisherComponentView *)view;
- (void)createPublisher:(NSDictionary *)properties;
- (void)setSessionId:(NSString *)sessionId;
- (void)setPublisherId:(NSString *)publisherId;
- (void)setPublishAudio:(BOOL)publishAudio;
- (void)setDegradationPreference:(int32_t)degradationPreference;
- (void)setPublishVideo:(BOOL)publishVideo;
- (void)setVideoContentHint:(NSString *)videoContentHint;
- (void)setMaxVideoBitrate:(int32_t)maxVideoBitrate;
- (void)setVideoBitratePreset:(NSString *)videoBitratePreset;
- (void)setCameraTorch:(BOOL)cameraTorch;
- (void)setCameraZoomFactor:(float)cameraZoomFactor;
- (void)setScaleBehavior:(NSString *)scaleBehavior;
- (void)setCameraPosition:(NSString *)cameraPosition;
- (void)cleanup;
@end

/// Mirrors OTRNSubscriberImpl (OTRNSubscriberComponentView.swift).
@interface OTRNSubscriberImpl : NSObject
@property (nonatomic, readonly) UIView *subscriberView;
- (instancetype)initWithView:(OTRNSubscriberComponentView *)view;
- (void)createSubscriber:(NSDictionary *)properties;
- (void)setSessionId:(NSString *)sessionId;
- (void)setStreamId:(NSString *)streamId;
- (void)setSubscribeToAudio:(BOOL)subscribeToAudio;
- (void)setSubscribeToVideo:(BOOL)subscribeToVideo;
- (void)setSubscribeToCaptions:(BOOL)subscribeToCaptions;
- (void)setScaleBehavior:(NSString *)scaleBehavior;
- (void)cleanup;
@end

NS_ASSUME_NONNULL_END
