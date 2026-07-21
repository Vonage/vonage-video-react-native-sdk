interface Signal {
  data: string;
}

type ScaleBehaviour = 'fit' | 'fill';

export enum DegradationPreference {
 
  NotSet = -1,
  MaintainFrameRateAndResolution = 0,
  MaintainFrameRate = 1,
  MaintainResolution = 2,
  Balanced = 3,
}

export interface Stream {
  streamId: string;
  name?: string;
  connectionId?: string;
}

export interface Input {
  apiKey: string;
  sessionId: string;
  token: string;
  encryptionSecret: string;
  signal: Signal;
  meetRoomName: string;
  userInitials: string;
}

export interface SessionEvents {
  archiveStart: number;
  archiveStop: number;
  connectionCreated: number;
  connectionDestroyed: number;
  error: number;
  forceMute: number;
  sessionConnected: number;
  sessionDisconnected: number;
  sessionReconnecting: number;
  sessionReconnected: number;
  signalReceived: number;
  streamCreated: number;
  streamDestroyed: number;
  streamPropertyChanged: number;
}

export interface PublisherEvents {
  audioLevel: number;
  audioNetworkStats: number;
  error: number;
  forceMute: number;
  rtcStatsReport: number;
  streamCreated: number;
  streamDestroyed: number;
  videoDisabled: number;
  videoDisableWarning: number;
  videoDisableWarningLifted: number;
  videoEnabled: number;
  videoNetworkStats: number;
}

export interface SubscriberEvents {
  audioLevel: number;
  audioNetworkStats: number;
  captionReceived: number;
  connected: number;
  disconnected: number;
  error: number;
  reconnected: number;
  subscriberConnected: number;
  rtcStatsReport: number;
  videoDataReceived: number;
  videoDisabled: number;
  videoDisableWarning: number;
  videoDisableWarningLifted: number;
  videoEnabled: number;
  videoNetworkStats: number;
}

export interface PublisherProperties {
  audioBitrate?: number;
  audioFallback?: {
    publisher?: boolean;
    subscriber?: boolean;
  };
  cameraTorch?: boolean;
  cameraZoomFactor?: number;
  audioFallbackEnabled?: boolean;
  audioTrack?: boolean;
  cameraPosition?: string;
  degradationPreference?: DegradationPreference;
  enableDtx?: boolean;
  frameRate?: 30 | 15 | 7 | 1;
  name?: string;
  videoTrack?: boolean;
  publishAudio?: boolean;
  publishVideo?: boolean;
  publishCaptions?: boolean;
  resolution?: '1920x1080' | '1280x720' | '640x480' | '352x288';
  videoSource?: string;
  scaleBehavior?: ScaleBehaviour;
  preferredVideoCodecs?: 'automatic' | ['vp8' | 'vp9' | 'h264', ...('vp8' | 'vp9' | 'h264')[]];
  publishSenderStats?: boolean;
}

export interface SubscriberProperties {
  subscribeToAudio?: boolean;
  subscribeToVideo?: boolean;
  subscribeToCaptions?: boolean;
  preferredResolution?: '1280x720' | '640x480' | '352x288';
  preferredFrameRate?: 30 | 15 | 7 | 1;
  audioVolume?: number;
  scaleBehavior?: ScaleBehaviour;
}

export interface VideoStats {
  frameRate: number;
  width: number;
  height: number;
}

export type TabName = 'session' | 'publisher' | 'subscriber' | 'moderation' | 'settings';

export interface State {
  connectedToSession: boolean;
  connectionSettingsExpanded: boolean;
  showRecIndicator: boolean;
  forceDisconnect: boolean;
  publisherProps: string;
  subscriberProps: string;
  connectionMode: 'manual' | 'meet';
  codecPreference: 'default' | 'automatic' | 'vp8' | 'vp9' | 'h264' | 'custom';
  customCodecOrder: ('vp8' | 'vp9' | 'h264')[];
  input: Input;
  sessionEvents: SessionEvents;
  publisherEvents: PublisherEvents;
  subscriberEvents: SubscriberEvents;
  publisherProperties: PublisherProperties;
  subscriberProperties: SubscriberProperties;
  isScreenSharing: boolean;
  isLoadingMeetCredentials: boolean;
  streams: Stream[];
  publisherVideoStats: VideoStats | null;
  activeTab: TabName;
  subscribedStreams: string[];
  unsubscribedStreams: string[];
}
