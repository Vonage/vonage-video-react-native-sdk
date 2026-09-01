import type { HostComponent, ViewProps } from 'react-native';
import type {
  BubblingEventHandler,
  Int32,
  Float,
} from 'react-native/Libraries/Types/CodegenTypes';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';

export type StreamEvent = {
  streamId: string;
};

export type ErrorEvent = {
  code: string;
  message: string;
};

export type EmptyEvent = {};

export type PublisherVideoNetworkStatsEvent = {
  jsonStats: string; // JSON string containing all video stats
};

export type AudioLevelEvent = {
  audioLevel: Float;
};

export type AudioNetworkStatsEvent = {
  jsonStats: string; // JSON string containing all audio stats
};

export type PublisherVideoStateEvent = {
  reason: string;
};

export type PublisherRTCStatsReportEvent = {
  jsonStats: string; // JSON string containing all event data
};

export interface NativeProps extends ViewProps {
  sessionId: string;
  publisherId: string;
  degradationPreference?: Int32;
  publishAudio?: boolean;
  publishVideo?: boolean;
  publishCaptions?: boolean;
  audioBitrate?: Int32;
  publisherAudioFallback?: boolean;
  subscriberAudioFallback?: boolean;
  audioTrack?: boolean;
  cameraPosition?: string;
  cameraTorch?: boolean;
  cameraZoomFactor?: Float;
  enableDtx?: boolean;
  frameRate?: Int32;
  name?: string;
  resolution?: string;
  scalableScreenshare?: boolean;
  allowAudioCaptureWhileMuted?: boolean;
  videoTrack?: boolean;
  videoSource?: string;
  videoContentHint?: string;
  maxVideoBitrate?: Int32;
  videoBitratePreset?: string;
  scaleBehavior?: string;
  publishSenderStats?: boolean;
  preferredVideoCodecs?: string;

  // Native emission gates for high-frequency events. When false, the native
  // side skips building the payload and dispatching the event entirely, so no
  // work crosses the bridge for events that have no JS handler attached.
  // Driven from JS by whether the corresponding eventHandler exists.
  emitAudioLevel?: boolean;
  emitAudioNetworkStats?: boolean;
  emitVideoNetworkStats?: boolean;

  onError?: BubblingEventHandler<ErrorEvent> | null;
  onStreamCreated?: BubblingEventHandler<StreamEvent> | null;
  onStreamDestroyed?: BubblingEventHandler<StreamEvent> | null;
  onAudioLevel?: BubblingEventHandler<AudioLevelEvent> | null;
  onAudioNetworkStats?: BubblingEventHandler<AudioNetworkStatsEvent> | null;
  onMuteForced?: BubblingEventHandler<EmptyEvent> | null;
  onRtcStatsReport?: BubblingEventHandler<PublisherRTCStatsReportEvent> | null;
  onVideoDisabled?: BubblingEventHandler<PublisherVideoStateEvent> | null;
  onVideoDisableWarning?: BubblingEventHandler<EmptyEvent> | null;
  onVideoDisableWarningLifted?: BubblingEventHandler<EmptyEvent> | null;
  onVideoEnabled?: BubblingEventHandler<PublisherVideoStateEvent> | null;
  onVideoNetworkStats?: BubblingEventHandler<PublisherVideoNetworkStatsEvent> | null;
}

export default codegenNativeComponent<NativeProps>(
  'OTRNPublisher'
) as HostComponent<NativeProps>;
