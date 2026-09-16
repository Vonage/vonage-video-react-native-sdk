// Regression test for PR #155 review: a rejected OT.connect() must be handled
// (logged) rather than surfacing as an unhandled promise rejection.

jest.mock('../OT', () => {
  const emitterNames = [
    'onSessionConnected', 'onSessionError', 'onStreamCreated', 'onStreamDestroyed',
    'onSignalReceived', 'onConnectionCreated', 'onConnectionDestroyed', 'onArchiveStarted',
    'onArchiveStopped', 'onMuteForced', 'onSessionReconnecting', 'onSessionReconnected',
    'onStreamPropertyChanged',
  ];
  const OT = { initSession: jest.fn(), setEncryptionSecret: jest.fn() };
  for (const n of emitterNames) OT[n] = jest.fn(() => ({ remove: jest.fn() }));
  OT.connect = jest.fn(() => Promise.reject(new Error('connect failed')));
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
jest.mock('../helpers/OTSessionHelper', () => ({
  dispatchEvent: jest.fn(),
  setIsConnected: jest.fn(),
  addStream: jest.fn(),
  removeStream: jest.fn(),
  clearStreams: jest.fn(),
  sanitizeSessionOptions: jest.fn(() => ({})),
}));
jest.mock('../OTError', () => ({ handleError: jest.fn() }));
jest.mock('../helpers/OTHelper', () => ({ logOT: jest.fn() }));

import OTSession from '../OTSession';
import { logOT } from '../helpers/OTHelper';

const base = () => ({
  apiKey: 'app-id',
  sessionId: 'sid-1',
  token: 'tok',
  options: {},
  eventHandlers: {},
  signal: {},
});

describe('OTSession connect() rejection handling', () => {
  it('logs a rejected connect instead of leaving it unhandled', async () => {
    const session = new OTSession(base());
    session.setState = jest.fn(); // component isn't mounted by React in this test
    session.componentDidMount();

    // flush the microtask queue so the connect().catch runs
    await Promise.resolve();
    await Promise.resolve();

    expect(logOT).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'rn_connect_error' })
    );
  });
});
