// Regression test for the signal dedupe compare in OTSession.componentDidUpdate:
// it must not re-send an unchanged signal payload, and must not throw when the
// payload can't be JSON.stringify'd (cyclic / BigInt). See PR #148 review.

jest.mock('../OT', () => {
  const emitterNames = [
    'onSessionConnected', 'onSessionError', 'onStreamCreated', 'onStreamDestroyed',
    'onSignalReceived', 'onConnectionCreated', 'onConnectionDestroyed', 'onArchiveStarted',
    'onArchiveStopped', 'onMuteForced', 'onSessionReconnecting', 'onSessionReconnected',
    'onStreamPropertyChanged',
  ];
  const methodNames = [
    'initSession', 'connect', 'disconnect', 'sendSignal', 'setEncryptionSecret',
  ];
  const OT = {};
  for (const n of emitterNames) OT[n] = jest.fn(() => ({ remove: jest.fn() }));
  for (const n of methodNames) OT[n] = jest.fn(() => Promise.resolve(null));
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

describe('OTSession signal dedupe (componentDidUpdate)', () => {
  it('does not re-send an unchanged signal payload on re-render', () => {
    const prev = { ...base(), signal: { type: 'chat', data: 'hi' } };
    const session = new OTSession(prev);
    OT.sendSignal.mockClear();

    // Parent re-renders with a NEW object identity but identical fields.
    session.props = { ...base(), signal: { type: 'chat', data: 'hi' } };
    session.componentDidUpdate(prev);

    expect(OT.sendSignal).not.toHaveBeenCalled();
  });

  it('re-sends when the signal payload changes', () => {
    const prev = { ...base(), signal: { type: 'chat', data: 'hi' } };
    const session = new OTSession(prev);
    OT.sendSignal.mockClear();

    session.props = { ...base(), signal: { type: 'chat', data: 'bye' } };
    session.componentDidUpdate(prev);

    expect(OT.sendSignal).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the signal payload is cyclic', () => {
    const prev = { ...base(), signal: { type: 'chat', data: 'hi' } };
    const session = new OTSession(prev);

    const cyclic = { type: 'chat', data: 'hi' };
    cyclic.self = cyclic; // JSON.stringify(cyclic) would throw

    session.props = { ...base(), signal: cyclic };
    expect(() => session.componentDidUpdate(prev)).not.toThrow();
  });
});
