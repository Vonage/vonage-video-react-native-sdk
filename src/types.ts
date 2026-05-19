import type React from 'react';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';

import type {
  ArchiveEvent,
  Connection,
  ConnectionEvent,
  IceConfig,
  MuteForcedEvent,
  SessionConnectEvent,
  SessionDisconnectEvent,
  SessionErrorEvent,
  SessionOptions,
  SignalEvent,
  Stream,
  StreamEvent,
  StreamPropertyChangedEvent,
} from './NativeOpentok';
import type {
  ErrorEvent,
  PublisherRTCStatsReportEvent,
  PublisherVideoNetworkStatsEvent,
  StreamEvent as PublisherStreamEvent,
} from './OTPublisherNativeComponent';
import type {
  StreamErrorEvent,
  SubscriberAudioLevelEvent,
  SubscriberAudioStatsEvent,
  SubscriberCaptionEvent,
  SubscriberRTCStatsReportEvent,
  SubscriberVideoNetworkStatsEvent,
  VideoDisabledEvent,
  VideoEnabledEvent,
} from './OTSubscriberNativeComponent';

export type {
  ArchiveEvent,
  Connection,
  ConnectionEvent,
  IceConfig,
  MuteForcedEvent,
  SessionConnectEvent,
  SessionDisconnectEvent,
  SessionErrorEvent,
  SessionOptions,
  SignalEvent,
  Stream,
  StreamEvent,
  StreamPropertyChangedEvent,
  ErrorEvent,
  PublisherRTCStatsReportEvent,
  PublisherVideoNetworkStatsEvent,
  PublisherStreamEvent,
  StreamErrorEvent,
  SubscriberAudioLevelEvent,
  SubscriberAudioStatsEvent,
  SubscriberCaptionEvent,
  SubscriberRTCStatsReportEvent,
  SubscriberVideoNetworkStatsEvent,
  VideoDisabledEvent,
  VideoEnabledEvent,
};

export type Callback<T = void> = () => T;
export type CallbackWithParam<P, T = void> = (param: P) => T;

export type VideoSource = 'screen' | 'camera';
export type VideoScaleType = 'fill' | 'fit';
export type VideoCodec = 'vp8' | 'vp9' | 'h264';
export type PreferredVideoCodecs = 'automatic' | [VideoCodec, ...VideoCodec[]];

export enum DegradationPreference {
  NotSet = -1,
  MaintainFrameRateAndResolution = 0,
  MaintainFrameRate = 1,
  MaintainResolution = 2,
  Balanced = 3,
}

export type ConnectionCreatedEvent = ConnectionEvent;
export type ConnectionDestroyedEvent = ConnectionEvent;
export type StreamCreatedEvent = Stream;
export type StreamDestroyedEvent = Stream;

export type PublisherAudioNetworkStats = {
  connectionId?: string;
  subscriberId?: string;
  audioPacketsLost: number;
  audioBytesSent: number;
  audioPacketsSent: number;
  timestamp: number;
};

export type PublisherVideoNetworkStats = {
  connectionId?: string;
  subscriberId?: string;
  videoPacketsLost: number;
  videoBytesSent: number;
  videoPacketsSent: number;
  timestamp: number;
};

export type SenderStats = {
  connectionMaxAllocatedBitrate: number;
  connectionEstimatedBandwidth: number;
};

export type VideoNetworkStatsEvent = {
  senderStats?: SenderStats;
  videoBytesReceived: number;
  videoPacketsLost: number;
  videoPacketsReceived: number;
  timestamp: number;
};

export type SubscriberAudioNetworkStatsEvent = {
  audioPacketsLost: number;
  audioPacketsReceived: number;
  audioBytesReceived: number;
  startTime: number;
};

export type SubscriberCaptionReceivedEvent = {
  text: string;
  isFinal: boolean;
};

export type SessionCapabilities = {
  canPublish: boolean;
  canSubscribe: boolean;
  canForceMute: boolean;
  canForceDisconnect: boolean;
};

export type OTSessionSessionOptions = SessionOptions & {
  androidOnTop?: 'publisher' | 'subscriber';
  androidZOrder?: 'mediaOverlay' | 'onTop';
};

export type OTSessionEventHandlers = {
  archiveStarted?: CallbackWithParam<ArchiveEvent>;
  archiveStopped?: CallbackWithParam<ArchiveEvent>;
  connectionCreated?: CallbackWithParam<ConnectionCreatedEvent>;
  connectionDestroyed?: CallbackWithParam<ConnectionDestroyedEvent>;
  error?: CallbackWithParam<SessionErrorEvent | ErrorEvent | unknown>;
  muteForced?: CallbackWithParam<MuteForcedEvent>;
  otrnError?: CallbackWithParam<unknown>;
  sessionConnected?: CallbackWithParam<SessionConnectEvent>;
  sessionDisconnected?: CallbackWithParam<SessionDisconnectEvent>;
  sessionReconnected?: CallbackWithParam<unknown>;
  sessionReconnecting?: CallbackWithParam<unknown>;
  signal?: CallbackWithParam<SignalEvent>;
  streamCreated?: CallbackWithParam<StreamCreatedEvent>;
  streamDestroyed?: CallbackWithParam<StreamDestroyedEvent>;
  streamPropertyChanged?: CallbackWithParam<StreamPropertyChangedEvent>;
};

export type OTPublisherProperties = {
  allowAudioCaptureWhileMuted?: boolean;
  audioBitrate?: number;
  audioFallback?: {
    publisher?: boolean;
    subscriber?: boolean;
  };
  audioTrack?: boolean;
  cameraPosition?: 'front' | 'back';
  cameraTorch?: boolean;
  cameraZoomFactor?: number;
  degradationPreference?: DegradationPreference;
  enableDtx?: boolean;
  frameRate?: 30 | 15 | 7 | 1;
  maxVideoBitrate?: number;
  name?: string;
  preferredVideoCodecs?: PreferredVideoCodecs | '';
  publishAudio?: boolean;
  publishCaptions?: boolean;
  publishSenderStats?: boolean;
  publishVideo?: boolean;
  resolution?: '1920x1080' | '1280x720' | '640x480' | '352x288' | 'MEDIUM';
  scalableScreenshare?: boolean;
  scaleBehavior?: VideoScaleType;
  videoBitratePreset?: 'default' | 'bw_saver' | 'extra_bw_saver';
  videoContentHint?: '' | 'motion' | 'detail' | 'text';
  videoSource?: VideoSource;
  videoTrack?: boolean;
};

export type OTPublisherEventHandlers = {
  audioLevel?: CallbackWithParam<{ audioLevel: number }>;
  audioNetworkStats?: CallbackWithParam<PublisherAudioNetworkStats[] | unknown>;
  error?: CallbackWithParam<ErrorEvent | unknown>;
  muteForced?: Callback;
  otrnError?: CallbackWithParam<unknown>;
  rtcStatsReport?: CallbackWithParam<Array<{ connectionId: string; jsonArrayOfReports: string }> | unknown>;
  streamCreated?: CallbackWithParam<PublisherStreamEvent>;
  streamDestroyed?: CallbackWithParam<PublisherStreamEvent>;
  videoDisabled?: CallbackWithParam<{ reason: string }>;
  videoDisableWarning?: CallbackWithParam<unknown>;
  videoDisableWarningLifted?: CallbackWithParam<unknown>;
  videoEnabled?: CallbackWithParam<{ reason: string }>;
  videoNetworkStats?: CallbackWithParam<PublisherVideoNetworkStats[] | unknown>;
};

export type OTSubscriberProperties = {
  audioVolume?: number;
  preferredFrameRate?: number;
  preferredResolution?:
    | string
    | {
        width?: number;
        height?: number;
      };

  /**
   * Defaults to `true` when omitted.
   */
  subscribeToAudio?: boolean;
  subscribeToCaptions?: boolean;
  
  /**
   * Defaults to `true` when omitted.
   */
  subscribeToVideo?: boolean;
  scaleBehavior?: VideoScaleType;
  style?: StyleProp<ViewStyle>;
};

export type OTSubscriberEventHandlers = {
  audioLevel?: CallbackWithParam<SubscriberAudioLevelEvent>;
  audioNetworkStats?: CallbackWithParam<SubscriberAudioStatsEvent | SubscriberAudioNetworkStatsEvent>;
  captionReceived?: CallbackWithParam<SubscriberCaptionEvent | SubscriberCaptionReceivedEvent>;
  /**
    * @deprecated Legacy alias for subscriber connection events.
    * Use `OTSubscriberEventHandlers.subscriberConnected` instead.
   */
  connected?: Callback;
  disconnected?: Callback;
  error?: CallbackWithParam<StreamErrorEvent | ErrorEvent | unknown>;
  otrnError?: CallbackWithParam<unknown>;
  rtcStatsReport?: CallbackWithParam<SubscriberRTCStatsReportEvent>;
  subscriberConnected?: CallbackWithParam<SubscriberStreamEvent>;
  videoDataReceived?: CallbackWithParam<SubscriberStreamEvent>;
  videoDisabled?: CallbackWithParam<VideoDisabledEvent>;
  videoDisableWarning?: CallbackWithParam<SubscriberStreamEvent>;
  videoDisableWarningLifted?: CallbackWithParam<SubscriberStreamEvent>;
  videoEnabled?: CallbackWithParam<VideoEnabledEvent>;
  videoNetworkStats?: CallbackWithParam<SubscriberVideoNetworkStatsEvent | VideoNetworkStatsEvent>;
};

export type SubscriberStreamEvent = {
  stream: Stream;
};

export type OTSessionProps = ViewProps & {
  apiKey?: string;
  applicationId?: string;
  sessionId: string;
  token: string;
  options?: OTSessionSessionOptions;
  signal?: {
    type?: string;
    data?: string;
    to?: string;
  };
  eventHandlers?: OTSessionEventHandlers;
  encryptionSecret?: string;
};

export type OTPublisherProps = ViewProps & {
  properties?: OTPublisherProperties;
  eventHandlers?: OTPublisherEventHandlers;
};

export type OTSubscriberProps = ViewProps & {
  sessionId?: string;
  streamId?: string;
  properties?: OTSubscriberProperties;
  streamProperties?: Record<string, OTSubscriberProperties>;
  eventHandlers?: OTSubscriberEventHandlers;
  subscribeToSelf?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  children?: (streamIds: string[]) => React.ReactElement[] | null;
};

export type OTSubscriberViewProps = ViewProps & {
  streamId: string;
};

export type OTSessionSignal = {
  type?: string;
  data?: string;
  to?: string;
};

export type OTSessionInstance = React.Component<OTSessionProps> & {
  reportIssue: () => Promise<string>;
  getCapabilities: () => Promise<SessionCapabilities>;
  forceMuteAll: (excludedStreamIds?: string[]) => Promise<boolean>;
  forceMuteStream: (streamId: string) => Promise<boolean>;
  disableForceMute: () => Promise<boolean>;
  signal: (signalObj: OTSessionSignal) => void;
  setEncryptionSecret: (value: string) => void;
  forceDisconnect: (connectionId: string) => Promise<boolean>;
};

export type OTPublisherInstance = React.Component<OTPublisherProps> & {
  getRtcStatsReport: () => void;
};

export type OTSubscriberInstance = React.Component<OTSubscriberProps> & {
  getRtcStatsReport: () => void;
};

export type OTSubscriberViewInstance = React.Component<OTSubscriberViewProps> & {
  getRtcStatsReport: () => void;
};

export type OTSessionComponent = React.ComponentClass<OTSessionProps> & {
  prototype: OTSessionInstance;
};

export type OTPublisherComponent = React.ComponentClass<OTPublisherProps> & {
  prototype: OTPublisherInstance;
};

export type OTSubscriberComponent = React.ComponentClass<OTSubscriberProps> & {
  prototype: OTSubscriberInstance;
};

export type OTSubscriberViewComponent = React.ComponentClass<OTSubscriberViewProps> & {
  prototype: OTSubscriberViewInstance;
};
/**
 * @deprecated Use OTSessionInstance for ref types
 */
export type OTSession = OTSessionInstance;

/**
 * @deprecated Use OTPublisherInstance for ref types
 */
export type OTPublisher = OTPublisherInstance;

/**
 * @deprecated Use OTSubscriberInstance for ref types
 */
export type OTSubscriber = OTSubscriberInstance;

/**
 * @deprecated Use OTSubscriberViewInstance for ref types
 */
export type OTSubscriberView = OTSubscriberViewInstance;