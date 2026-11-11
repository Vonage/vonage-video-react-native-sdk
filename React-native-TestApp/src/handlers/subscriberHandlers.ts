import { summarizeRtcReports } from '../utils/statsSummary';

const streamIdOf = (event: any) => event?.stream?.streamId ?? event?.streamId;

export const createSubscriberHandlers = (
  updateEvent: (group: string, type: string, value: any) => void,
  subscriberEvents: any,
  logSubscriberVideoStats?: (event: any) => void,
  captureEvent?: (eventType: string, payload: any) => void,
  onSubscriberConnected?: (streamId: string) => void
) => ({
  audioLevel: (event: any) => {
    updateEvent('subscriberEvents', 'audioLevel', true);
    captureEvent?.('subscriberAudioLevel', {
      audioLevel: event?.audioLevel,
      streamId: streamIdOf(event),
    });
  },
  audioNetworkStats: (event: any) => {
    updateEvent('subscriberEvents', 'audioNetworkStats', true);
    captureEvent?.('subscriberAudioNetworkStats', {
      streamId: streamIdOf(event),
      stats: event?.stats,
      hasJsonStats: typeof event?.jsonStats === 'string',
    });
  },
  reconnected: (event: any) => {
    console.log('Subscriber reconnected event:', event);
    updateEvent('subscriberEvents', 'reconnected', true);
  },
  subscriberConnected: (event: any) => {
    console.log('Subscriber subscriberConnected event:', event);
    updateEvent('subscriberEvents', 'subscriberConnected', true);
    const streamId = streamIdOf(event);
    if (streamId) onSubscriberConnected?.(streamId);
    captureEvent?.('subscriberConnected', { streamId });
  },
  subscriberDisconnected: (event: any) => {
    console.log('Subscriber subscriberDisconnected event:', event);
    updateEvent('subscriberEvents', 'subscriberDisconnected', true);
  },
  videoDataReceived: (event: any) => {
    updateEvent('subscriberEvents', 'videoDataReceived', true);
    captureEvent?.('subscriberVideoDataReceived', { stream: event?.stream });
  },
  videoDisabled: (event: any) => {
    updateEvent('subscriberEvents', 'videoDisabled', true);
    captureEvent?.('subscriberVideoDisabled', {
      reason: event?.reason,
      streamId: streamIdOf(event),
    });
  },
  videoEnabled: (event: any) => {
    updateEvent('subscriberEvents', 'videoEnabled', true);
    captureEvent?.('subscriberVideoEnabled', {
      reason: event?.reason,
      streamId: streamIdOf(event),
    });
  },
  videoNetworkStats: (event: any) => {
    logSubscriberVideoStats?.(event);
    updateEvent('subscriberEvents', 'videoNetworkStats', true);
    captureEvent?.('subscriberVideoNetworkStats', {
      streamId: streamIdOf(event),
      stats: event?.stats,
      hasJsonStats: typeof event?.jsonStats === 'string',
    });
  },
  rtcStatsReport: (event: any) => {
    updateEvent('subscriberEvents', 'rtcStatsReport', true);
    let summary: any = null;
    try {
      summary = summarizeRtcReports(event?.stats ?? event?.jsonStats);
    } catch (e: any) {
      summary = { parseError: String(e?.message ?? e) };
    }
    captureEvent?.('subscriberRtcStatsReport', {
      streamId: streamIdOf(event),
      hasJsonStats: typeof event?.jsonStats === 'string',
      ...summary,
    });
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
    captureEvent?.('subscriberError', {
      code: event?.error?.code ?? event?.code,
      message: event?.error?.message ?? event?.message,
      streamId: streamIdOf(event),
    });
  },
  videoDisableWarning: (event: any) => {
    updateEvent('subscriberEvents', 'videoDisableWarning', true);
  },
  videoDisableWarningLifted: (event: any) => {
    updateEvent('subscriberEvents', 'videoDisableWarningLifted', true);
  },
});
