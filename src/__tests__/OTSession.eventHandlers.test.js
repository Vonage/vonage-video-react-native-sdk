const mockCaptured = {};
jest.mock('../OT', () => {
  const emitterNames = [
    'onSessionConnected', 'onSessionError', 'onStreamCreated', 'onStreamDestroyed',
    'onSignalReceived', 'onConnectionCreated', 'onConnectionDestroyed', 'onArchiveStarted',
    'onArchiveStopped', 'onMuteForced', 'onSessionReconnecting', 'onSessionReconnected',
    'onStreamPropertyChanged', 'onSessionDisconnected',
  ];
  const methodNames = [
    'initSession', 'connect', 'disconnect', 'sendSignal', 'setEncryptionSecret',
    'getCapabilities', 'reportIssue', 'forceMuteAll', 'forceMuteStream',
    'forceDisconnect', 'disableForceMute', 'getSubscriberRtcStatsReport',
  ];
  const OT = {};
  for (const n of emitterNames) {
    OT[n] = jest.fn((cb) => {
      mockCaptured[n] = cb;
      return { remove: jest.fn() };
    });
  }
  for (const n of methodNames) {
    OT[n] = jest.fn(() => Promise.resolve(null));
  }
  return { OT, checkAndroidPermissions: jest.fn(() => Promise.resolve()) };
});
jest.mock('react-native', () => ({
  View: ({ children }) => children ?? null,
  Platform: { OS: 'ios', Version: 18 },
}));
jest.mock(
  'deprecated-react-native-prop-types',
  () => ({ ViewPropTypes: { style: () => null } }),
  { virtual: true }
);
jest.mock('../helpers/OTHelper', () => ({
  logOT: jest.fn(),
  sanitizeBooleanProperty: (v) => (v === undefined ? true : Boolean(v)),
}));

import OTSession from '../OTSession';

const baseProps = () => ({
  apiKey: 'app-id',
  sessionId: 'sid-1',
  token: 'tok',
  signal: {},
  options: {},
});

describe('OTSession eventHandlers prop update', () => {
  it('dispatches to the handlers from the latest props after a re-render', () => {
    const first = jest.fn();
    const second = jest.fn();

    const props = { ...baseProps(), eventHandlers: { sessionConnected: first } };
    const session = new OTSession(props);

    const previous = props;
    session.props = { ...props, eventHandlers: { sessionConnected: second } };
    session.componentDidUpdate(previous);

    expect(typeof mockCaptured.onSessionConnected).toBe('function');
    mockCaptured.onSessionConnected({ sessionId: 'sid-1', connectionId: 'c1' });

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('still dispatches to the mount-time handler when props are unchanged', () => {
    const only = jest.fn();
    const props = { ...baseProps(), eventHandlers: { sessionConnected: only } };
    const session = new OTSession(props);

    mockCaptured.onSessionConnected({ sessionId: 'sid-1', connectionId: 'c1' });

    expect(only).toHaveBeenCalledTimes(1);
  });
});
