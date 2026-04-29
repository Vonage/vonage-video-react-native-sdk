import React from 'react';
import type { OTSessionProps, SessionCapabilities } from './types';

declare class OTSession extends React.Component<OTSessionProps, unknown> {
  reportIssue(): Promise<string>;
  getCapabilities(): Promise<SessionCapabilities>;
  forceMuteAll(excludedStreamIds?: string[]): Promise<boolean>;
  forceMuteStream(streamId: string): Promise<boolean>;
  disableForceMute(): Promise<boolean>;
  signal(signalObj: { type?: string; data?: string; to?: string }): void;
  setEncryptionSecret(value: string): void;
  forceDisconnect(connectionId: string): Promise<boolean>;
}

export default OTSession;
