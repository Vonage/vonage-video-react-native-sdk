#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <react/renderer/components/RNOpentokReactNativeSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNOpentokReactNativeSpec/EventEmitters.h>
#import <react/renderer/components/RNOpentokReactNativeSpec/Props.h>
#import <react/renderer/components/RNOpentokReactNativeSpec/RCTComponentViewHelpers.h>
#import <RNOpentokReactNativeSpec/RNOpentokReactNativeSpec.h>
#import <React/RCTConversions.h>
#import <React/RCTViewComponentView.h>
#if __has_include(<OpentokReactNative/OpentokReactNative-Swift.h>)
#import <OpentokReactNative/OpentokReactNative-Swift.h>
#else
#import <OpentokReactNative-Swift.h>
#endif

static inline std::string SafeStdStringFromValue(id value) {
    if ([value isKindOfClass:[NSString class]]) {
        return std::string([(NSString *)value UTF8String]);
    }
    return std::string("");
}

using namespace facebook::react;

@interface OTRNPublisherComponentView
    : RCTViewComponentView <RCTOTRNPublisherViewProtocol>
@end

@implementation OTRNPublisherComponentView {
    OTRNPublisherImpl *_impl;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
    return concreteComponentDescriptorProvider<
        OTRNPublisherComponentDescriptor>();
}

- (NSDictionary *)createPublisherPropsFromViewProps:
    (const OTRNPublisherProps &)viewProps {
    return @{
        @"sessionId" : RCTNSStringFromString(viewProps.sessionId),
        @"publisherId" : RCTNSStringFromString(viewProps.publisherId),
        @"videoTrack" : @(viewProps.videoTrack),
        @"audioTrack" : @(viewProps.audioTrack),
        @"audioBitrate" : @(viewProps.audioBitrate),
        @"frameRate" : @(viewProps.frameRate),
        @"resolution" : RCTNSStringFromString(viewProps.resolution),
        @"enableDtx" : @(viewProps.enableDtx),
        @"name" : RCTNSStringFromString(viewProps.name),
        @"publisherAudioFallback" : @(viewProps.publisherAudioFallback),
        @"subscriberAudioFallback" : @(viewProps.subscriberAudioFallback),
        @"videoContentHint" : RCTNSStringFromString(viewProps.videoContentHint),
        @"cameraTorch" : @(viewProps.cameraTorch),
        @"cameraZoomFactor" : @(viewProps.cameraZoomFactor),
        @"videoSource" : RCTNSStringFromString(viewProps.videoSource),
        @"cameraPosition" : RCTNSStringFromString(viewProps.cameraPosition),
        @"scalableScreenshare" : @(viewProps.scalableScreenshare),
        @"publishAudio" : @(viewProps.publishAudio),
        @"degradationPreference" : @(viewProps.degradationPreference),
        @"publishVideo" : @(viewProps.publishVideo),
        @"publishCaptions" : @(viewProps.publishCaptions),
        @"allowAudioCaptureWhileMuted" : @(viewProps.allowAudioCaptureWhileMuted),
        @"maxVideoBitrate" : @(viewProps.maxVideoBitrate),
        @"videoBitratePreset" : RCTNSStringFromString(viewProps.videoBitratePreset),
        @"scaleBehavior": RCTNSStringFromString(viewProps.scaleBehavior),
        @"publishSenderStats": @(viewProps.publishSenderStats),
        @"preferredVideoCodecs": RCTNSStringFromString(viewProps.preferredVideoCodecs)
    };
}

- (instancetype)initWithFrame:(CGRect)frame {
    if (self = [super initWithFrame:frame]) {
        _impl = [[OTRNPublisherImpl alloc] initWithView:self];
        self.contentView = nil;
    }
    return self;
}

- (void)updateProps:(const Props::Shared &)props
           oldProps:(const Props::Shared &)oldProps {

    const auto &oldViewProps =
        *std::static_pointer_cast<const OTRNPublisherProps>(_props);
    const auto &newViewProps =
        *std::static_pointer_cast<const OTRNPublisherProps>(props);

    // Check if this is the first update (oldProps will be null/empty)
    if (!oldProps) {
        NSAssert(self.contentView == nil,
                 @"ContentView should be nil on first update");
        NSDictionary *publisherProperties =
            [self createPublisherPropsFromViewProps:newViewProps];
        [_impl createPublisher:publisherProperties];
        self.contentView = _impl.publisherView;
    }

    if (oldViewProps.sessionId != newViewProps.sessionId) {
        [_impl setSessionId:RCTNSStringFromString(newViewProps.sessionId)];
    }

    if (oldViewProps.publisherId != newViewProps.publisherId) {
        [_impl setPublisherId:RCTNSStringFromString(newViewProps.publisherId)];
    }

    if (oldViewProps.publishAudio != newViewProps.publishAudio) {
        [_impl setPublishAudio:newViewProps.publishAudio];
    }

    if (oldViewProps.degradationPreference != newViewProps.degradationPreference) {
        [_impl setDegradationPreference:newViewProps.degradationPreference];
    }

    if (oldViewProps.publishVideo != newViewProps.publishVideo) {
        [_impl setPublishVideo:newViewProps.publishVideo];
    }

    if (oldViewProps.videoContentHint != newViewProps.videoContentHint) {
        [_impl setVideoContentHint:RCTNSStringFromString(newViewProps.videoContentHint)];
    }

    if (oldViewProps.maxVideoBitrate != newViewProps.maxVideoBitrate) {
        [_impl setMaxVideoBitrate:(newViewProps.maxVideoBitrate)];
    }

    if (oldViewProps.videoBitratePreset != newViewProps.videoBitratePreset) {
        [_impl setVideoBitratePreset:RCTNSStringFromString(newViewProps.videoBitratePreset)];
    }

    if (oldViewProps.cameraTorch != newViewProps.cameraTorch) {
        [_impl setCameraTorch:newViewProps.cameraTorch];
    }

    if (oldViewProps.cameraZoomFactor != newViewProps.cameraZoomFactor) {
        [_impl setCameraZoomFactor:newViewProps.cameraZoomFactor];
    }

    if (oldViewProps.scaleBehavior != newViewProps.scaleBehavior) {
        [_impl setScaleBehavior:RCTNSStringFromString(newViewProps.scaleBehavior)];
    }

    if (oldViewProps.cameraPosition != newViewProps.cameraPosition) {
        [_impl setCameraPosition:RCTNSStringFromString(newViewProps.cameraPosition)];
    }

    [super updateProps:props oldProps:oldProps];
}

//The view instance (and its _impl) is reused after recycling, not recreated.
- (void)prepareForRecycle {
    if (_impl) {
       [_impl cleanup];
    }
    self.contentView = nil;
    [super prepareForRecycle];
}

- (std::shared_ptr<const OTRNPublisherEventEmitter>)getEventEmitter {
    if (!_eventEmitter) {
        return nullptr;
    }
    return std::static_pointer_cast<const OTRNPublisherEventEmitter>(_eventEmitter);
}

- (void)handleStreamCreated:(NSDictionary *)eventData {
    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNPublisherEventEmitter::OnStreamCreated payload{
            .streamId = SafeStdStringFromValue(eventData[@"streamId"])};
        eventEmitter->onStreamCreated(std::move(payload));
    }
}

- (void)handleError:(NSDictionary *)eventData {
    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNPublisherEventEmitter::OnError payload{
            .code = SafeStdStringFromValue(eventData[@"code"]),
            .message = SafeStdStringFromValue(eventData[@"message"])};
        eventEmitter->onError(std::move(payload));
    }
}

- (void)handleStreamDestroyed:(NSDictionary *)eventData {
    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNPublisherEventEmitter::OnStreamDestroyed payload{
            .streamId = SafeStdStringFromValue(eventData[@"streamId"])};
        eventEmitter->onStreamDestroyed(std::move(payload));
    }
}

- (void)handleAudioLevel:(float)audioLevel {
    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNPublisherEventEmitter::OnAudioLevel payload{
            .audioLevel = audioLevel};
        eventEmitter->onAudioLevel(std::move(payload));
    }
}

- (void)handleAudioNetworkStats:(NSString *)jsonString {
    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNPublisherEventEmitter::OnAudioNetworkStats payload{
            .jsonStats = SafeStdStringFromValue(jsonString)};
        eventEmitter->onAudioNetworkStats(std::move(payload));
    }
}

- (void)handleVideoNetworkStats:(NSString *)jsonString {
    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNPublisherEventEmitter::OnVideoNetworkStats payload{
            .jsonStats = SafeStdStringFromValue(jsonString)};
        eventEmitter->onVideoNetworkStats(std::move(payload));
    }
}

- (void)handleMuteForced {
    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNPublisherEventEmitter::OnMuteForced payload{};
        eventEmitter->onMuteForced(std::move(payload));
    }
}

- (void)handleRtcStatsReport:(NSString *)jsonString {
    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNPublisherEventEmitter::OnRtcStatsReport payload{
            .jsonStats = SafeStdStringFromValue(jsonString)
        };
        eventEmitter->onRtcStatsReport(std::move(payload));
    }
}

- (void)handleVideoDisableWarning {
    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNPublisherEventEmitter::OnVideoDisableWarning payload{};
        eventEmitter->onVideoDisableWarning(std::move(payload));
    }
}

- (void)handleVideoDisableWarningLifted {
    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNPublisherEventEmitter::OnVideoDisableWarningLifted payload{};
        eventEmitter->onVideoDisableWarningLifted(std::move(payload));
    }
}

- (void)handleVideoEnabled:(NSDictionary *)eventData {
    NSString *reason = eventData[@"reason"] ?: @"";
    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNPublisherEventEmitter::OnVideoEnabled payload{
            .reason = SafeStdStringFromValue(reason)
        };
        eventEmitter->onVideoEnabled(std::move(payload));
    }
}
- (void)handleVideoDisabled:(NSDictionary *)eventData {
    NSString *reason = eventData[@"reason"] ?: @"";
    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNPublisherEventEmitter::OnVideoDisabled payload{
            .reason = SafeStdStringFromValue(reason)
        };
        eventEmitter->onVideoDisabled(std::move(payload));
    }
}
@end

Class<RCTComponentViewProtocol> OTRNPublisherCls(void) {
    return OTRNPublisherComponentView.class;
}
