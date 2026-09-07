import type { CodegenTypes, HostComponent, ViewProps } from 'react-native';
import { codegenNativeComponent } from 'react-native';

export interface StreamEvent {
  stream: {
    name: string;
    streamId: string;
    hasAudio: boolean;
    hasCaptions?: boolean;
    hasVideo: boolean;
    sessionId: string;
    width: CodegenTypes.Double;
    height: CodegenTypes.Double;
    videoType: string; //  "screen" | "camera";
    connection: {
      creationTime: string;
      data: string;
      connectionId: string;
    };
    creationTime: string;
  };
}

export interface StreamErrorEvent extends StreamEvent {
  error: {
    code: string;
    message: string;
  };
}

export type EmptyEvent = {};

export interface SubscriberVideoNetworkStatsEvent extends StreamEvent {
  jsonStats: string; // JSON string containing all video stats
}

export interface SubscriberAudioStatsEvent extends StreamEvent {
  jsonStats: string; // JSON string containing all audio stats
}

export interface SubscriberAudioLevelEvent extends StreamEvent {
  audioLevel: CodegenTypes.Float;
}

export interface SubscriberRTCStatsReportEvent extends StreamEvent {
  jsonStats: string;
}

export interface SubscriberCaptionEvent extends StreamEvent {
  text: string;
  isFinal: boolean;
}

export interface VideoDisabledEvent extends StreamEvent {
  reason: string;
}

export interface VideoEnabledEvent extends StreamEvent {
  reason: string;
}

export interface NativeProps extends ViewProps {
  sessionId: string;
  streamId: string;
  subscribeToAudio?: CodegenTypes.WithDefault<boolean, true>;
  subscribeToVideo?: CodegenTypes.WithDefault<boolean, true>;
  scaleBehavior?: string;

  subscribeToCaptions?: boolean;
  audioVolume?: CodegenTypes.Float;
  preferredFrameRate?: CodegenTypes.Int32;
  preferredResolution?: string;

  onSubscriberConnected?: CodegenTypes.BubblingEventHandler<StreamEvent> | null;
  onSubscriberDisconnected?: CodegenTypes.BubblingEventHandler<StreamEvent> | null;
  onSubscriberError?: CodegenTypes.BubblingEventHandler<StreamErrorEvent> | null;
  onRtcStatsReport?: CodegenTypes.BubblingEventHandler<SubscriberRTCStatsReportEvent> | null;
  onAudioLevel?: CodegenTypes.BubblingEventHandler<SubscriberAudioLevelEvent> | null;
  onAudioNetworkStats?: CodegenTypes.BubblingEventHandler<SubscriberAudioStatsEvent> | null;
  onCaptionReceived?: CodegenTypes.BubblingEventHandler<SubscriberCaptionEvent> | null;
  onVideoDataReceived?: CodegenTypes.BubblingEventHandler<StreamEvent> | null;
  onVideoDisabled?: CodegenTypes.BubblingEventHandler<VideoDisabledEvent> | null;
  onVideoDisableWarning?: CodegenTypes.BubblingEventHandler<StreamEvent> | null;
  onVideoDisableWarningLifted?: CodegenTypes.BubblingEventHandler<StreamEvent> | null;
  onVideoEnabled?: CodegenTypes.BubblingEventHandler<VideoEnabledEvent> | null;
  onVideoNetworkStats?: CodegenTypes.BubblingEventHandler<SubscriberVideoNetworkStatsEvent> | null;
  onReconnected?: CodegenTypes.BubblingEventHandler<StreamEvent> | null;
}

export default codegenNativeComponent<NativeProps>(
  'OTRNSubscriber'
) as HostComponent<NativeProps>;
