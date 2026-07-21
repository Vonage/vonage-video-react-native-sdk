export const createPublisherHandlers = (
  updateEvent: (group: string, type: string, value: any) => void,
  setStreamId: (streamId: string) => void,
  publisherEvents: any
) => ({
  audioLevel: (event: any) => {
    updateEvent('publisherEvents', 'audioLevel', true);
  },
  audioNetworkStats: (event: any) => {
    updateEvent('publisherEvents', 'audioNetworkStats', true);
  },
  videoNetworkStats: (event: any) => {
    updateEvent('publisherEvents', 'videoNetworkStats', true);
  },
  streamCreated: (event: any) => {
    updateEvent('publisherEvents', 'streamCreated', true);
    setStreamId(event.streamId);
  },
  streamDestroyed: (event: any) => {
    updateEvent('publisherEvents', 'streamDestroyed', true);
  },
  muteForced: (event: any) => {
    updateEvent('publisherEvents', 'forceMute', true);
  },
  rtcStatsReport: (event: any) => {
    updateEvent('publisherEvents', 'rtcStatsReport', true);
  },
  error: (event: any) => {
    updateEvent('publisherEvents', 'error', true);
  },
  videoDisabled: (event: any) => {
    updateEvent('publisherEvents', 'videoDisabled', true);
  },
  videoDisableWarning: (event: any) => {
    updateEvent('publisherEvents', 'videoDisableWarning', true);
  },
  videoDisableWarningLifted: (event: any) => {
    updateEvent('publisherEvents', 'videoDisableWarningLifted', true);
  },
  videoEnabled: (event: any) => {
    updateEvent('publisherEvents', 'videoEnabled', true);
  },
});
