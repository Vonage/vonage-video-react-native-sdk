import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type ArchiveEvent = {
  archiveId: string;
  name: string;
  sessionId: string;
};

export type Connection = {
  creationTime: string;
  data: string;
  connectionId: string;
};

export type ConnectionEvent = {
  creationTime: string;
  data: string;
  connectionId: string;
  sessionId: string;
};

export type EmptyEvent = {};

export type IceConfig = {
  includeServers: string; // 'all' | 'custom';
  transportPolicy: string; // 'all' | 'relay';
  filterOutLanCandidates: boolean;
  customServers: {
    urls: string[];
    username?: string;
    credential?: string;
  }[];
};

export type MuteForcedEvent = {
  active: boolean;
};

export type SessionOptions = {
  androidZOrder?: string;
  apiUrl?: string;
  connectionEventsSuppressed?: boolean;
  enableStereoOutput?: boolean;
  enableSinglePeerConnection?: boolean;
  sessionMigration?: boolean;
  iceConfig?: IceConfig;
  ipWhitelist?: boolean;
  isCamera2Capable?: boolean;
  proxyUrl?: string;
  useTextureViews?: boolean;
};

export type SessionConnectEvent = {
  sessionId: string;
  connection: {
    connectionId: string;
    creationTime: string;
    data: string;
  };
};

export type SessionDisconnectEvent = {
  sessionId: string;
};

export type Stream = {
  name: string;
  streamId: string;
  hasAudio: boolean;
  hasCaptions?: boolean;
  hasVideo: boolean;
  sessionId: string;
  width: number;
  height: number;
  videoType: string; //  "screen" | "camera";
  connection: Connection;
  creationTime: string;
};

export type StreamEvent = Stream;

// NOTE: `oldValue`/`newValue` are polymorphic at runtime — a `{ width, height }`
// object for `videoDimensions` changes, a boolean for `hasAudio`/`hasVideo`/
// `hasCaptions`, or a string for `videoType`. The event is emitted on BOTH iOS
// (via `emit(onStreamPropertyChanged:)` in ios/Utils/Utils.swift) and Android,
// each through a loosely-typed native map (NSDictionary / WritableMap) that
// forwards the raw value to JS unchanged. React Native's New-Architecture codegen
// (>= 0.82) rejects a non-homogenous union (object | boolean | string), so this
// spec type declares only the structured `videoDimensions` shape to keep codegen
// valid; the accurate public union is `StreamPropertyChangedEvent` in types.ts,
// which is what consumers import.
export type StreamPropertyChangedValue = {
  width?: number;
  height?: number;
};

export type StreamPropertyChangedEvent = {
  oldValue: StreamPropertyChangedValue;
  newValue: StreamPropertyChangedValue;
  stream: Stream;
  changedProperty: string;
};

export type SignalEvent = {
  sessionId: string;
  connectionId: string;
  type: string;
  data: string;
};

export type SessionErrorEvent = {
  code: string;
  message: string;
};

export interface Spec extends TurboModule {
  readonly onArchiveStarted: CodegenTypes.EventEmitter<ArchiveEvent>;
  readonly onArchiveStopped: CodegenTypes.EventEmitter<ArchiveEvent>;
  readonly onConnectionCreated: CodegenTypes.EventEmitter<ConnectionEvent>;
  readonly onConnectionDestroyed: CodegenTypes.EventEmitter<ConnectionEvent>;
  readonly onMuteForced: CodegenTypes.EventEmitter<MuteForcedEvent>;
  readonly onSessionConnected: CodegenTypes.EventEmitter<SessionConnectEvent>;
  readonly onSessionDisconnected: CodegenTypes.EventEmitter<SessionDisconnectEvent>;
  readonly onSessionReconnecting: CodegenTypes.EventEmitter<EmptyEvent>;
  readonly onSessionReconnected: CodegenTypes.EventEmitter<EmptyEvent>;
  readonly onStreamCreated: CodegenTypes.EventEmitter<StreamEvent>;
  readonly onStreamDestroyed: CodegenTypes.EventEmitter<StreamEvent>;
  readonly onStreamPropertyChanged: CodegenTypes.EventEmitter<StreamPropertyChangedEvent>;
  readonly onSignalReceived: CodegenTypes.EventEmitter<SignalEvent>;
  readonly onSessionError: CodegenTypes.EventEmitter<SessionErrorEvent>;
  initSession(
    apiKey: string,
    sessionId: string,
    options?: SessionOptions
  ): void;
  connect(sessionId: string, token: string): Promise<void>;
  disconnect(sessionId: string): Promise<void>;
  getSubscriberRtcStatsReport(sessionId: string): void;
  getPublisherRtcStatsReport(sessionId: string, publisherId: string): void;
  setAudioTransformers(
    sessionId: string,
    publisherId: string,
    transformers: Array<{
      name: string;
      properties?: string;
    }>
  ): void;
  setVideoTransformers(
    sessionId: string,
    publisherId: string,
    transformers: Array<{
      name: string;
      properties?: string;
    }>
  ): void;
  publish(sessionId: string, publisherId: string): void;
  unpublish(sessionId: string, publisherId: string): void;
  removeSubscriber(sessionId: string, streamId: string): void;
  sendSignal(sessionId: string, type: string, data: string, to: string): void;
  setEncryptionSecret(sessionId: string, secret: string): Promise<void>;
  getCapabilities(sessionId: string): Promise<{
    canPublish: boolean;
    canSubscribe: boolean;
    canForceMute: boolean;
    canForceDisconnect: boolean;
  }>;
  reportIssue(sessionId: string): Promise<string>;
  forceMuteAll(
    sessionId: string,
    excludedStreamIds: string[]
  ): Promise<boolean>;
  forceMuteStream(sessionId: string, streamId: string): Promise<boolean>;
  forceDisconnect(sessionId: string, connectionId: string): Promise<boolean>;
  disableForceMute(sessionId: string): Promise<boolean>;

  // --- Calling services: iOS CallKit / Android ConnectionService (issue #285) ---

  /** True when calling-services mode can be used. iOS: false while a custom
   *  audio device is installed (e.g. a session created with enableStereoOutput). */
  isCallingServicesModeAvailable(): Promise<boolean>;

  /** iOS only. Hands AVAudioSession activation to CallKit. Call early in the app lifecycle. */
  enableCallingServicesMode(): Promise<void>;
  /** iOS only. Configures (does not activate) the session before a CXAnswer/CXStartCallAction. */
  preconfigureAudioSessionForCall(mode?: string): Promise<void>;
  /** iOS only. Forward from CXProviderDelegate provider(_:didActivate:). */
  notifyAudioSessionActivated(): Promise<void>;
  /** iOS only. Forward from CXProviderDelegate provider(_:didDeactivate:). */
  notifyAudioSessionDeactivated(): Promise<void>;

  /** Android only. false delegates audio-focus control to the app/ConnectionService. */
  setRequestAudioFocus(requestFocus: boolean): Promise<void>;
  /** Android only. Forward when the Connection becomes active. */
  notifyAudioFocusActivated(): Promise<void>;
  /** Android only. Forward when the call ends. */
  notifyAudioFocusDeactivated(): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('OpentokReactNative');
