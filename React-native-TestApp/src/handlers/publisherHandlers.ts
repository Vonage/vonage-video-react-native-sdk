export const createPublisherHandlers = (
  updateEvent: (group: string, type: string, value: any) => void,
  setStreamId: (streamId: string) => void,
  publisherEvents: any,
  captureEvent: (eventType: string, payload: any) => void
) => ({
  audioLevel: (event: any) => {
    updateEvent('publisherEvents', 'audioLevel', true);
    captureEvent('publisherAudioLevel', {
      audioLevel: typeof event === 'number' ? event : event?.audioLevel,
    });
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
    captureEvent('publisherMuteForced', {});
  },
  rtcStatsReport: (event: any) => {
    updateEvent('publisherEvents', 'rtcStatsReport', true);
  },
  error: (event: any) => {
    updateEvent('publisherEvents', 'error', true);
    captureEvent('publisherError', {
      code: event?.code ?? event?.error?.code,
      message: event?.message ?? event?.error?.message,
      type: event?.type,
    });
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
