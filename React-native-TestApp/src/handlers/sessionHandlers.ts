export const createSessionHandlers = (
  updateEvent: (group: string, type: string, value: any) => void,
  onCapabilities: () => void,
  setShowRecIndicator: (show: boolean) => void,
  onStreamCreated: (stream: any) => void,
  onStreamDestroyed: (streamId: string) => void
) => ({
  archiveStarted: (event: any) => {
    updateEvent('sessionEvents', 'archiveStart', true);
    setShowRecIndicator(true);
  },
  archiveStopped: (event: any) => {
    updateEvent('sessionEvents', 'archiveStop', true);
    setShowRecIndicator(false);
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
  },
  streamDestroyed: (event: any) => {
    updateEvent('sessionEvents', 'streamDestroyed', true);
    if (event.stream && event.stream.streamId) {
      onStreamDestroyed(event.stream.streamId);
    } else if (event.streamId) {
      onStreamDestroyed(event.streamId);
    }
  },
  connectionCreated: (event: any) => {
    updateEvent('sessionEvents', 'connectionCreated', true);
  },
  connectionDestroyed: (event: any) => {
    updateEvent('sessionEvents', 'connectionDestroyed', true);
  },
  streamPropertyChanged: (event: any) => {
    updateEvent('sessionEvents', 'streamPropertyChanged', true);
  },
  signal: (event: any) => {
    updateEvent('sessionEvents', 'signalReceived', true);
  },
  muteForced: (event: any) => {
  },
  error: (event: any) => {
    updateEvent('sessionEvents', 'error', true);
  },
  otrnError: (event: any) => {
  },
});
