export const createPublisherHandlers = (
  updateEvent: (group: string, type: string, value: any) => void,
  setStreamId: (streamId: string) => void,
  publisherEvents: any,
  captureEvent: (eventType: string, payload: any) => void
) => ({
  audioLevel: (event: any) => {
    updateEvent('publisherEvents', 'audioLevel', true);
  },
  audioNetworkStats: (event: any) => {
    updateEvent('publisherEvents', 'audioNetworkStats', true);
    captureEvent('publisherAudioNetworkStats', event);
  },
  videoNetworkStats: (event: any) => {
    updateEvent('publisherEvents', 'videoNetworkStats', true);
    captureEvent('publisherVideoNetworkStats', event);
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
