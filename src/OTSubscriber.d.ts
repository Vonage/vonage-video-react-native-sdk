import React from 'react';
import type { OTSubscriberProps } from './types';

declare class OTSubscriber extends React.Component<OTSubscriberProps, unknown> {
  getRtcStatsReport(): void;
}

export default OTSubscriber;
