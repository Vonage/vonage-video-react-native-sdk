export const createSubscriberHandlers = (
  updateEvent: (group: string, type: string, value: any) => void,
  subscriberEvents: any,
  logSubscriberVideoStats?: (event: any) => void,
  captureEvent?: (eventType: string, payload: any) => void
) => ({
  audioLevel: (event: any) => {
    updateEvent('subscriberEvents', 'audioLevel', true);
  },
  audioNetworkStats: (event: any) => {
    updateEvent('subscriberEvents', 'audioNetworkStats', true);
    captureEvent?.('subscriberAudioNetworkStats', event);
  },
  connected: (event: any) => {
    console.log('Subscriber connected event:', event);
    updateEvent('subscriberEvents', 'connected', true);
  },
  disconnected: (event: any) => {
    console.log('Subscriber disconnected event:', event);
    updateEvent('subscriberEvents', 'disconnected', true);
  },
  reconnected: (event: any) => {
    console.log('Subscriber reconnected event:', event);
    updateEvent('subscriberEvents', 'reconnected', true);
  },
  subscriberConnected: (event: any) => {
    console.log('Subscriber subscriberConnected event:', event);
    updateEvent('subscriberEvents', 'subscriberConnected', true);
  },
  videoDataReceived: (event: any) => {
    updateEvent('subscriberEvents', 'videoDataReceived', true);
    captureEvent?.('subscriberVideoDataReceived', { stream: event?.stream });
  },
  videoDisabled: (event: any) => {
    updateEvent('subscriberEvents', 'videoDisabled', true);
  },
  videoEnabled: (event: any) => {
    updateEvent('subscriberEvents', 'videoEnabled', true);
  },
  videoNetworkStats: (event: any) => {
    logSubscriberVideoStats?.(event);
    updateEvent('subscriberEvents', 'videoNetworkStats', true);
    captureEvent?.('subscriberVideoNetworkStats', event);
  },
  rtcStatsReport: (event: any) => {
    updateEvent('subscriberEvents', 'rtcStatsReport', true);
  },
  captionReceived: (event: any) => {
    updateEvent('subscriberEvents', 'captionReceived', true);
    captureEvent?.('captionReceived', {
      text: event?.text,
      isFinal: event?.isFinal,
      stream: event?.stream,
    });
  },
  error: (event: any) => {
    updateEvent('subscriberEvents', 'error', true);
  },
  videoDisableWarning: (event: any) => {
    updateEvent('subscriberEvents', 'videoDisableWarning', true);
  },
  videoDisableWarningLifted: (event: any) => {
    updateEvent('subscriberEvents', 'videoDisableWarningLifted', true);
  },
});
