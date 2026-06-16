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
  archiveStart: boolean;
  archiveStop: boolean;
  connectionCreated: boolean;
  connectionDestroyed: boolean;
  error: boolean;
  forceMute: boolean;
  sessionConnected: boolean;
  sessionDisconnected: boolean;
  signalReceived: boolean;
  streamCreated: boolean;
  streamDestroyed: boolean;
  streamPropertyChanged: boolean;
}

export interface PublisherEvents {
  audioLevel: boolean;
  audioNetworkStats: boolean;
  forceMute: boolean;
  rtcStatsReport: boolean;
  streamCreated: boolean;
  streamDestroyed: boolean;
  videoNetworkStats: boolean;
}

export interface SubscriberEvents {
  audioLevel: boolean;
  audioNetworkStats: boolean;
  connected: boolean;
  disconnected: boolean;
  reconnected: boolean;
  subscriberConnected: boolean;
  rtcStatsReport: boolean;
  videoDataReceived: boolean;
  videoDisabled: boolean;
  videoEnabled: boolean;
  videoNetworkStats: boolean;
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

export interface State {
  connectedToSession: boolean;
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
}
