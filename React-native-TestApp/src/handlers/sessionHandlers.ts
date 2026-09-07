export const createSessionHandlers = (
  updateEvent: (group: string, type: string, value: any) => void,
  onCapabilities: () => void,
  setShowRecIndicator: (show: boolean) => void,
  onStreamCreated: (stream: any) => void,
  onStreamDestroyed: (streamId: string) => void,
  captureEvent: (eventType: string, payload: any) => void
) => ({
  archiveStarted: (event: any) => {
    updateEvent('sessionEvents', 'archiveStart', true);
    setShowRecIndicator(true);
    captureEvent('archiveStarted', {
      archiveId: event?.archiveId,
      name: event?.name,
      sessionId: event?.sessionId,
    });
  },
  archiveStopped: (event: any) => {
    updateEvent('sessionEvents', 'archiveStop', true);
    setShowRecIndicator(false);
    captureEvent('archiveStopped', {
      archiveId: event?.archiveId,
      name: event?.name,
      sessionId: event?.sessionId,
    });
  },
  sessionConnected: (event: any) => {
    updateEvent('sessionEvents', 'sessionConnected', true);
    onCapabilities();
  },
  sessionDisconnected: (event: any) => {
    updateEvent('sessionEvents', 'sessionDisconnected', true);
  },
  streamCreated: (event: any) => {
    if (event.stream) {
      onStreamCreated(event.stream);
    } else if (event.streamId) {
      onStreamCreated({ streamId: event.streamId, ...event });
    } else {
      onStreamCreated(event);
    }
    updateEvent('sessionEvents', 'streamCreated', true);
    const stream = event.stream || event;
    captureEvent('streamCreated', {
      streamId: stream?.streamId,
      name: stream?.name,
      hasAudio: stream?.hasAudio,
      hasVideo: stream?.hasVideo,
      videoType: stream?.videoType,
    });
  },
  streamDestroyed: (event: any) => {
    updateEvent('sessionEvents', 'streamDestroyed', true);
    if (event.stream && event.stream.streamId) {
      onStreamDestroyed(event.stream.streamId);
      captureEvent('streamDestroyed', { streamId: event.stream.streamId });
    } else if (event.streamId) {
      onStreamDestroyed(event.streamId);
      captureEvent('streamDestroyed', { streamId: event.streamId });
    }
  },
  connectionCreated: (event: any) => {
    updateEvent('sessionEvents', 'connectionCreated', true);
    captureEvent('connectionCreated', {
      connectionId: event?.connectionId,
      creationTime: event?.creationTime,
      data: event?.data,
      sessionId: event?.sessionId,
    });
  },
  connectionDestroyed: (event: any) => {
    updateEvent('sessionEvents', 'connectionDestroyed', true);
    captureEvent('connectionDestroyed', {
      connectionId: event?.connectionId,
      creationTime: event?.creationTime,
      data: event?.data,
      sessionId: event?.sessionId,
    });
  },
  streamPropertyChanged: (event: any) => {
    updateEvent('sessionEvents', 'streamPropertyChanged', true);
    captureEvent('streamPropertyChanged', {
      changedProperty: event?.changedProperty,
      oldValue: event?.oldValue,
      newValue: event?.newValue,
      stream: event?.stream,
    });
  },
  signal: (event: any) => {
    updateEvent('sessionEvents', 'signalReceived', true);
    captureEvent('signal', {
      type: event?.type,
      data: event?.data,
      connectionId: event?.connectionId,
      sessionId: event?.sessionId,
    });
  },
  sessionReconnecting: (event: any) => {
    updateEvent('sessionEvents', 'sessionReconnecting', true);
  },
  sessionReconnected: (event: any) => {
    updateEvent('sessionEvents', 'sessionReconnected', true);
  },
  muteForced: (event: any) => {
    updateEvent('sessionEvents', 'forceMute', true);
    captureEvent('muteForced', event?.active !== undefined ? { active: event.active } : {});
  },
  error: (event: any) => {
    updateEvent('sessionEvents', 'error', true);
    captureEvent('sessionError', {
      code: event?.code,
      message: event?.message,
    });
  },
  otrnError: (event: any) => {
  },
});
