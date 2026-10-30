// Regression test for #154: a rejected OT.connect() is reported through
// eventHandlers.error instead of surfacing as an unhandled promise rejection.

jest.mock('../OT', () => {
  const emitterNames = [
    'onSessionConnected',
    'onSessionError',
    'onStreamCreated',
    'onStreamDestroyed',
    'onSignalReceived',
    'onConnectionCreated',
    'onConnectionDestroyed',
    'onArchiveStarted',
    'onArchiveStopped',
    'onMuteForced',
    'onSessionReconnecting',
    'onSessionReconnected',
    'onStreamPropertyChanged',
    'onSessionDisconnected',
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
import { OT } from '../OT';

const base = () => ({
  apiKey: 'app-id',
  sessionId: 'sid-1',
  token: 'tok',
  options: {},
  eventHandlers: {},
  signal: {},
});

const mount = (props) => {
  const session = new OTSession(props);
  session.setState = jest.fn(); // component isn't mounted by React in this test
  session.componentDidMount();
  return session;
};

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const emitSessionError = (event) =>
  OT.onSessionError.mock.calls.at(-1)[0](event);

describe('OTSession connect() rejection handling', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports a rejected connect through eventHandlers.error', async () => {
    const error = jest.fn();
    mount({ ...base(), eventHandlers: { error } });
    await flush();

    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'connect failed', sessionId: 'sid-1' })
    );
  });

  it('reports a connect failure once when it is also emitted as sessionError', async () => {
    const error = jest.fn();
    mount({ ...base(), eventHandlers: { error } });
    emitSessionError({
      sessionId: 'sid-1',
      code: 1004,
      message: 'auth failed',
    });
    await flush();

    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ code: 1004, message: 'auth failed' })
    );
  });

  it('passes later session errors through after connecting', async () => {
    OT.connect.mockImplementationOnce(() => Promise.resolve());
    const error = jest.fn();
    mount({ ...base(), eventHandlers: { error } });
    OT.onSessionConnected.mock.calls.at(-1)[0]({
      sessionId: 'sid-1',
      connection: {},
    });
    await flush();
    emitSessionError({ sessionId: 'sid-1', code: 1, message: 'a' });
    emitSessionError({ sessionId: 'sid-1', code: 2, message: 'b' });

    expect(error).toHaveBeenCalledTimes(2);
  });
});
