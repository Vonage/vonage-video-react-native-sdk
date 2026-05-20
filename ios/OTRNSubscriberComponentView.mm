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

static inline std::string SafeStdStringFromDescription(id value) {
    if ([value isKindOfClass:[NSString class]]) {
        return std::string([(NSString *)value UTF8String]);
    }
    if (value && [value respondsToSelector:@selector(description)]) {
        NSString *description = [value description];
        if ([description isKindOfClass:[NSString class]]) {
            return std::string([description UTF8String]);
        }
    }
    return std::string("");
}

static inline bool SafeBoolFromValue(id value) {
    if ([value respondsToSelector:@selector(boolValue)]) {
        return [value boolValue];
    }
    return false;
}

static inline double SafeDoubleFromValue(id value) {
    if ([value respondsToSelector:@selector(doubleValue)]) {
        return [value doubleValue];
    }
    return 0.0;
}

template <typename T>
T makeConnectionStruct(NSDictionary *connectionDict) {
    NSDictionary *safeConnectionDict = [connectionDict isKindOfClass:[NSDictionary class]]
        ? connectionDict
        : @{};
    return T{
        .creationTime = SafeStdStringFromValue(safeConnectionDict[@"creationTime"]),
        .data = SafeStdStringFromValue(safeConnectionDict[@"data"]),
        .connectionId = SafeStdStringFromValue(safeConnectionDict[@"connectionId"])
    };
}

template <typename StreamStruct, typename ConnectionStruct>
StreamStruct makeStreamStruct(NSDictionary *streamDict) {
    NSDictionary *safeStreamDict = [streamDict isKindOfClass:[NSDictionary class]]
        ? streamDict
        : @{};
    id connectionValue = safeStreamDict[@"connection"];
    NSDictionary *connectionDict = [connectionValue isKindOfClass:[NSDictionary class]]
        ? connectionValue
        : @{};
    return StreamStruct{
        .name = SafeStdStringFromValue(safeStreamDict[@"name"]),
        .streamId = SafeStdStringFromValue(safeStreamDict[@"streamId"]),
        .hasAudio = SafeBoolFromValue(safeStreamDict[@"hasAudio"]),
        .hasCaptions = SafeBoolFromValue(safeStreamDict[@"hasCaptions"]),
        .hasVideo = SafeBoolFromValue(safeStreamDict[@"hasVideo"]),
        .sessionId = SafeStdStringFromValue(safeStreamDict[@"sessionId"]),
        .width = SafeDoubleFromValue(safeStreamDict[@"width"]),
        .height = SafeDoubleFromValue(safeStreamDict[@"height"]),
        .videoType = SafeStdStringFromValue(safeStreamDict[@"videoType"]),
        .connection = makeConnectionStruct<ConnectionStruct>(connectionDict),
        .creationTime = SafeStdStringFromValue(safeStreamDict[@"creationTime"])
    };
}

using namespace facebook::react;

@interface OTRNSubscriberComponentView : RCTViewComponentView <RCTOTRNSubscriberViewProtocol>
@end

@implementation OTRNSubscriberComponentView {
    OTRNSubscriberImpl *_impl;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
    return concreteComponentDescriptorProvider<OTRNSubscriberComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame {
    if (self = [super initWithFrame:frame]) {
        _impl = [[OTRNSubscriberImpl alloc] initWithView:self];
        self.contentView = nil;
    }
    return self;
}

- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps {
    const auto &oldViewProps = *std::static_pointer_cast<const OTRNSubscriberProps>(_props);
    const auto &newViewProps = *std::static_pointer_cast<const OTRNSubscriberProps>(props);

    if (!oldProps) {
        // Check if this is the first update (oldProps will be null/empty)
        NSAssert(self.contentView == nil,
                 @"ContentView should be nil on first update");
        NSDictionary *subscriberProperties = @{
            @"sessionId": RCTNSStringFromString(newViewProps.sessionId),
            @"streamId": RCTNSStringFromString(newViewProps.streamId),
            @"subscribeToAudio": @(newViewProps.subscribeToAudio),
            @"subscribeToVideo": @(newViewProps.subscribeToVideo),
            @"scaleBehavior": RCTNSStringFromString(newViewProps.scaleBehavior)
        };
        [_impl createSubscriber:subscriberProperties];
        self.contentView = _impl.subscriberView;
    }

    if (oldViewProps.sessionId != newViewProps.sessionId) {
        [_impl setSessionId:RCTNSStringFromString(newViewProps.sessionId)];
    }

    if (oldViewProps.streamId != newViewProps.streamId) {
        [_impl setStreamId:RCTNSStringFromString(newViewProps.streamId)];
    }

    if (oldViewProps.subscribeToAudio != newViewProps.subscribeToAudio) {
        [_impl setSubscribeToAudio:newViewProps.subscribeToAudio];
    }

    if (oldViewProps.subscribeToVideo != newViewProps.subscribeToVideo) {
        [_impl setSubscribeToVideo:newViewProps.subscribeToVideo];
    }

    if (oldViewProps.scaleBehavior != newViewProps.scaleBehavior) {
        [_impl setScaleBehavior:RCTNSStringFromString(newViewProps.scaleBehavior)];
    }

    [super updateProps:props oldProps:oldProps];
}

//The view instance (and its _impl) is reused after recycling, not recreated.
- (void)prepareForRecycle {
    // Clean up native resources, observers, etc.
    if (_impl) {
      [_impl cleanup]; 
    }
    self.contentView = nil;
    [super prepareForRecycle];
}

- (std::shared_ptr<const OTRNSubscriberEventEmitter>)getEventEmitter {
    if (!_eventEmitter) {
        return nullptr;
    }
    return std::static_pointer_cast<const OTRNSubscriberEventEmitter>(_eventEmitter);
}

- (void)handleSubscriberConnected:(NSDictionary *)stream {
    NSDictionary *streamDict = stream[@"stream"];
    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNSubscriberEventEmitter::OnSubscriberConnected payload{
            .stream = makeStreamStruct<
                OTRNSubscriberEventEmitter::OnSubscriberConnectedStream,
                OTRNSubscriberEventEmitter::OnSubscriberConnectedStreamConnection
            >(streamDict)
        };
        eventEmitter->onSubscriberConnected(std::move(payload));
    }
}

- (void)handleSubscriberDisconnected:(NSDictionary *)eventData {
    NSDictionary *streamDict = eventData[@"stream"];
    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNSubscriberEventEmitter::OnSubscriberDisconnected payload{
            .stream = makeStreamStruct<
                OTRNSubscriberEventEmitter::OnSubscriberDisconnectedStream,
                OTRNSubscriberEventEmitter::OnSubscriberDisconnectedStreamConnection
            >(streamDict)
        };
        eventEmitter->onSubscriberDisconnected(std::move(payload));
    }
}

- (void)handleError:(NSDictionary *)eventData {
    NSDictionary *streamDict = eventData[@"stream"];
    NSDictionary *errorDict = [eventData[@"error"] isKindOfClass:[NSDictionary class]]
        ? eventData[@"error"]
        : @{};

    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNSubscriberEventEmitter::OnSubscriberErrorError errorStruct{
            .code = SafeStdStringFromValue(errorDict[@"code"]),
            .message = SafeStdStringFromValue(errorDict[@"message"])
        };
        OTRNSubscriberEventEmitter::OnSubscriberError payload{
            .stream = makeStreamStruct<
                OTRNSubscriberEventEmitter::OnSubscriberErrorStream,
                OTRNSubscriberEventEmitter::OnSubscriberErrorStreamConnection
            >(streamDict),
            .error = errorStruct
        };
        eventEmitter->onSubscriberError(std::move(payload));
    }
}

- (void)handleRtcStatsReport:(NSDictionary *)eventData {
    NSDictionary *streamDict = eventData[@"stream"];
    id jsonStatsValue = eventData[@"jsonStats"];

    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNSubscriberEventEmitter::OnRtcStatsReport payload{
            .stream = makeStreamStruct<
                OTRNSubscriberEventEmitter::OnRtcStatsReportStream,
                OTRNSubscriberEventEmitter::OnRtcStatsReportStreamConnection
            >(streamDict),
            .jsonStats = SafeStdStringFromValue(jsonStatsValue)
        };
        eventEmitter->onRtcStatsReport(std::move(payload));
    }
}

- (void)handleAudioLevel:(NSDictionary *)eventData {
    float audioLevel = static_cast<float>(SafeDoubleFromValue(eventData[@"audioLevel"]));
    NSDictionary *streamDict = eventData[@"stream"];

    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNSubscriberEventEmitter::OnAudioLevel payload{
            .stream = makeStreamStruct<
                OTRNSubscriberEventEmitter::OnAudioLevelStream,
                OTRNSubscriberEventEmitter::OnAudioLevelStreamConnection
            >(streamDict),
            .audioLevel = audioLevel
        };
        eventEmitter->onAudioLevel(std::move(payload));
    }
}

- (void)handleVideoNetworkStats:(NSDictionary *)eventData {
    NSDictionary *streamDict = eventData[@"stream"];
    id jsonStatsValue = eventData[@"jsonStats"];

    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNSubscriberEventEmitter::OnVideoNetworkStats payload{
            .stream = makeStreamStruct<
                OTRNSubscriberEventEmitter::OnVideoNetworkStatsStream,
                OTRNSubscriberEventEmitter::OnVideoNetworkStatsStreamConnection
            >(streamDict),
            .jsonStats = SafeStdStringFromValue(jsonStatsValue)
        };
        eventEmitter->onVideoNetworkStats(std::move(payload));
    }
}

- (void)handleAudioNetworkStats:(NSDictionary *)eventData {
    NSDictionary *streamDict = eventData[@"stream"];
    id jsonStatsValue = eventData[@"jsonStats"];

    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNSubscriberEventEmitter::OnAudioNetworkStats payload{
            .stream = makeStreamStruct<
                OTRNSubscriberEventEmitter::OnAudioNetworkStatsStream,
                OTRNSubscriberEventEmitter::OnAudioNetworkStatsStreamConnection
            >(streamDict),
            .jsonStats = SafeStdStringFromValue(jsonStatsValue)
        };
        eventEmitter->onAudioNetworkStats(std::move(payload));
    }
}

- (void)handleVideoEnabled:(NSDictionary *)eventData {
    NSDictionary *streamDict = eventData[@"stream"];
    id reasonValue = eventData[@"reason"];

    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNSubscriberEventEmitter::OnVideoEnabled payload{
            .stream = makeStreamStruct<
                OTRNSubscriberEventEmitter::OnVideoEnabledStream,
                OTRNSubscriberEventEmitter::OnVideoEnabledStreamConnection
            >(streamDict),
            .reason = SafeStdStringFromValue(reasonValue)
        };
        eventEmitter->onVideoEnabled(std::move(payload));
    }
}

- (void)handleVideoDisabled:(NSDictionary *)eventData {
    NSDictionary *streamDict = eventData[@"stream"];
    id reasonValue = eventData[@"reason"];

    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNSubscriberEventEmitter::OnVideoDisabled payload{
            .stream = makeStreamStruct<
                OTRNSubscriberEventEmitter::OnVideoDisabledStream,
                OTRNSubscriberEventEmitter::OnVideoDisabledStreamConnection
            >(streamDict),
            .reason = SafeStdStringFromValue(reasonValue)
        };
        eventEmitter->onVideoDisabled(std::move(payload));
    }
}

- (void)handleVideoDisableWarning:(NSDictionary *)eventData {
    NSDictionary *streamDict = eventData[@"stream"];

    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNSubscriberEventEmitter::OnVideoDisableWarning payload{
            .stream = makeStreamStruct<
                OTRNSubscriberEventEmitter::OnVideoDisableWarningStream,
                OTRNSubscriberEventEmitter::OnVideoDisableWarningStreamConnection
            >(streamDict)
        };
        eventEmitter->onVideoDisableWarning(std::move(payload));
    }
}

- (void)handleVideoDisableWarningLifted:(NSDictionary *)eventData {
    NSDictionary *streamDict = eventData[@"stream"];

    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNSubscriberEventEmitter::OnVideoDisableWarningLifted payload{
            .stream = makeStreamStruct<
                OTRNSubscriberEventEmitter::OnVideoDisableWarningLiftedStream,
                OTRNSubscriberEventEmitter::OnVideoDisableWarningLiftedStreamConnection
            >(streamDict)
        };
        eventEmitter->onVideoDisableWarningLifted(std::move(payload));
    }
}

- (void)handleVideoDataReceived:(NSDictionary *)eventData {
    NSDictionary *streamDict = eventData[@"stream"];

    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNSubscriberEventEmitter::OnVideoDataReceived payload{
            .stream = makeStreamStruct<
                OTRNSubscriberEventEmitter::OnVideoDataReceivedStream,
                OTRNSubscriberEventEmitter::OnVideoDataReceivedStreamConnection
            >(streamDict)
        };
        eventEmitter->onVideoDataReceived(std::move(payload));
    }
}

- (void)handleReconnected:(NSDictionary *)eventData {
    NSDictionary *streamDict = eventData[@"stream"];

    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNSubscriberEventEmitter::OnReconnected payload{
            .stream = makeStreamStruct<
                OTRNSubscriberEventEmitter::OnReconnectedStream,
                OTRNSubscriberEventEmitter::OnReconnectedStreamConnection
            >(streamDict)
        };
        eventEmitter->onReconnected(std::move(payload));
    }
}

- (void)handleCaptionReceived:(NSDictionary *)eventData {
    NSDictionary *streamDict = eventData[@"stream"];
    id textValue = eventData[@"text"];
    BOOL isFinal = SafeBoolFromValue(eventData[@"isFinal"]);

    auto eventEmitter = [self getEventEmitter];
    if (eventEmitter) {
        OTRNSubscriberEventEmitter::OnCaptionReceived payload{
            .stream = makeStreamStruct<
                OTRNSubscriberEventEmitter::OnCaptionReceivedStream,
                OTRNSubscriberEventEmitter::OnCaptionReceivedStreamConnection
            >(streamDict),
            .text = SafeStdStringFromDescription(textValue),
            .isFinal = isFinal
        };
        eventEmitter->onCaptionReceived(std::move(payload));
    }
}
@end

Class<RCTComponentViewProtocol> OTRNSubscriberCls(void) {
    return OTRNSubscriberComponentView.class;
}
