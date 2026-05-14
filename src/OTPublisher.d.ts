import React from 'react';
import type { OTPublisherProps } from './types';

declare class OTPublisher extends React.Component<OTPublisherProps, unknown> {
  getRtcStatsReport(): void;
}

export default OTPublisher;
