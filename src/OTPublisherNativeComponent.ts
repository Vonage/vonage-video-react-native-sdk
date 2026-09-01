import type { CodegenTypes, HostComponent, ViewProps } from 'react-native';
import { codegenNativeComponent } from 'react-native';

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
  audioLevel: CodegenTypes.Float;
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
  degradationPreference?: CodegenTypes.Int32;
  publishAudio?: boolean;
  publishVideo?: boolean;
  publishCaptions?: boolean;
  audioBitrate?: CodegenTypes.Int32;
  publisherAudioFallback?: boolean;
  subscriberAudioFallback?: boolean;
  audioTrack?: boolean;
  cameraPosition?: string;
  cameraTorch?: boolean;
  cameraZoomFactor?: CodegenTypes.Float;
  enableDtx?: boolean;
  frameRate?: CodegenTypes.Int32;
  name?: string;
  resolution?: string;
  scalableScreenshare?: boolean;
  allowAudioCaptureWhileMuted?: boolean;
  videoTrack?: boolean;
  videoSource?: string;
  videoContentHint?: string;
  maxVideoBitrate?: CodegenTypes.Int32;
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

  onError?: CodegenTypes.BubblingEventHandler<ErrorEvent> | null;
  onStreamCreated?: CodegenTypes.BubblingEventHandler<StreamEvent> | null;
  onStreamDestroyed?: CodegenTypes.BubblingEventHandler<StreamEvent> | null;
  onAudioLevel?: CodegenTypes.BubblingEventHandler<AudioLevelEvent> | null;
  onAudioNetworkStats?: CodegenTypes.BubblingEventHandler<AudioNetworkStatsEvent> | null;
  onMuteForced?: CodegenTypes.BubblingEventHandler<EmptyEvent> | null;
  onRtcStatsReport?: CodegenTypes.BubblingEventHandler<PublisherRTCStatsReportEvent> | null;
  onVideoDisabled?: CodegenTypes.BubblingEventHandler<PublisherVideoStateEvent> | null;
  onVideoDisableWarning?: CodegenTypes.BubblingEventHandler<EmptyEvent> | null;
  onVideoDisableWarningLifted?: CodegenTypes.BubblingEventHandler<EmptyEvent> | null;
  onVideoEnabled?: CodegenTypes.BubblingEventHandler<PublisherVideoStateEvent> | null;
  onVideoNetworkStats?: CodegenTypes.BubblingEventHandler<PublisherVideoNetworkStatsEvent> | null;
}

export default codegenNativeComponent<NativeProps>(
  'OTRNPublisher'
) as HostComponent<NativeProps>;
