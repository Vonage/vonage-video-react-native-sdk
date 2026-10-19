/**
 * OTSession Event Dispatch Tests
 *
 * Verifies that every native event emitter is subscribed once and that the
 * sessionId guard in initSession dispatches (or drops) events correctly —
 * including null-safe handling for payloads without a sessionId
 * (GitHub issue #300).
 */

// Mock OT.js: each onXxx emitter records its listener and returns a
// subscription object, like the real TurboModule event emitters.
jest.mock('../OT', () => {
  const listeners = {};
  const emitter = (name) =>
    jest.fn((cb) => {
      listeners[name] = cb;
      return { remove: jest.fn() };
    });
  return {
    OT: {
      initSession: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      onSessionConnected: emitter('onSessionConnected'),
      onSessionDisconnected: emitter('onSessionDisconnected'),
      onSessionError: emitter('onSessionError'),
      onMuteForced: emitter('onMuteForced'),
      onSessionReconnecting: emitter('onSessionReconnecting'),
      onSessionReconnected: emitter('onSessionReconnected'),
      onStreamPropertyChanged: emitter('onStreamPropertyChanged'),
      onStreamCreated: emitter('onStreamCreated'),
      onStreamDestroyed: emitter('onStreamDestroyed'),
      onSignalReceived: emitter('onSignalReceived'),
      onConnectionCreated: emitter('onConnectionCreated'),
      onConnectionDestroyed: emitter('onConnectionDestroyed'),
      onArchiveStarted: emitter('onArchiveStarted'),
      onArchiveStopped: emitter('onArchiveStopped'),
    },
    __listeners: listeners,
    checkAndroidPermissions: jest.fn(),
    nativeEvents: {},
  };
});

jest.mock('../helpers/OTSessionHelper', () => ({
  dispatchEvent: jest.fn(),
  setIsConnected: jest.fn(),
  addStream: jest.fn(),
  removeStream: jest.fn(),
  clearStreams: jest.fn(),
  sanitizeSessionOptions: jest.fn(() => ({})),
}));

jest.mock('../OTError', () => ({
  handleError: jest.fn(),
}));

jest.mock('../helpers/OTHelper', () => ({
  logOT: jest.fn(),
}));

jest.mock('../generated/packageInfo', () => ({
  OTRN_PACKAGE_INFO: { name: '@vonage/client-sdk-video-react-native' },
}));

import OTSession from '../OTSession';
import { OT, __listeners } from '../OT';
import { setIsConnected } from '../helpers/OTSessionHelper';

const SESSION_ID = 'sess-1';

const EMITTERS = [
  'onSessionConnected',
  'onSessionDisconnected',
  'onSessionError',
  'onMuteForced',
  'onSessionReconnecting',
  'onSessionReconnected',
  'onStreamPropertyChanged',
  'onStreamCreated',
  'onStreamDestroyed',
  'onSignalReceived',
  'onConnectionCreated',
  'onConnectionDestroyed',
  'onArchiveStarted',
  'onArchiveStopped',
];

const createSession = (eventHandlers = {}) =>
  new OTSession({
    apiKey: 'k',
    sessionId: SESSION_ID,
    token: 't',
    eventHandlers,
    options: {},
    signal: {},
  });

describe('OTSession native event dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(__listeners).forEach((key) => delete __listeners[key]);
  });

  it('subscribes to all 14 native emitters exactly once', () => {
    createSession();

    EMITTERS.forEach((name) => {
      expect(OT[name]).toHaveBeenCalledTimes(1);
      expect(typeof __listeners[name]).toBe('function');
    });
    expect(Object.keys(__listeners).sort()).toEqual([...EMITTERS].sort());
  });

  it('invokes error handler only when payload carries a matching sessionId', () => {
    const error = jest.fn();
    createSession({ error });

    const event = { sessionId: SESSION_ID, code: '1004', message: 'x' };
    __listeners.onSessionError(event);
    expect(error).toHaveBeenCalledWith(event);

    error.mockClear();
    __listeners.onSessionError({ code: '1004', message: 'x' });
    expect(error).not.toHaveBeenCalled();
  });

  it('invokes muteForced handler only when payload carries a matching sessionId', () => {
    const muteForced = jest.fn();
    createSession({ muteForced });

    const event = { sessionId: SESSION_ID, active: true };
    __listeners.onMuteForced(event);
    expect(muteForced).toHaveBeenCalledWith(event);

    muteForced.mockClear();
    __listeners.onMuteForced({ active: true });
    expect(muteForced).not.toHaveBeenCalled();
  });

  it.each(['onSessionReconnecting', 'onSessionReconnected'])(
    'handles %s with a sessionId payload and ignores null without throwing',
    (emitterName) => {
      const handlerName =
        emitterName === 'onSessionReconnecting'
          ? 'sessionReconnecting'
          : 'sessionReconnected';
      const handler = jest.fn();
      createSession({ [handlerName]: handler });

      const event = { sessionId: SESSION_ID };
      __listeners[emitterName](event);
      expect(handler).toHaveBeenCalledWith(event);

      handler.mockClear();
      expect(() => __listeners[emitterName](null)).not.toThrow();
      expect(handler).not.toHaveBeenCalled();
    }
  );

  it('invokes streamPropertyChanged handler with the full payload', () => {
    const streamPropertyChanged = jest.fn();
    createSession({ streamPropertyChanged });

    const event = {
      sessionId: SESSION_ID,
      changedProperty: 'hasAudio',
      oldValue: false,
      newValue: true,
      stream: { streamId: 's1', sessionId: SESSION_ID },
    };
    __listeners.onStreamPropertyChanged(event);
    expect(streamPropertyChanged).toHaveBeenCalledWith(event);
  });

  it('invokes sessionDisconnected handler and marks session disconnected', () => {
    const sessionDisconnected = jest.fn();
    createSession({ sessionDisconnected });

    const event = { sessionId: SESSION_ID };
    __listeners.onSessionDisconnected(event);
    expect(sessionDisconnected).toHaveBeenCalledWith(event);
    expect(setIsConnected).toHaveBeenCalledWith(SESSION_ID, false);
  });

  it('ignores events whose sessionId belongs to a different session', () => {
    const eventHandlers = {
      error: jest.fn(),
      muteForced: jest.fn(),
      sessionReconnecting: jest.fn(),
      sessionReconnected: jest.fn(),
      streamPropertyChanged: jest.fn(),
      sessionDisconnected: jest.fn(),
    };
    createSession(eventHandlers);

    __listeners.onSessionError({
      sessionId: 'sess-2',
      code: '1004',
      message: 'x',
    });
    __listeners.onMuteForced({ sessionId: 'sess-2', active: true });
    __listeners.onSessionReconnecting({ sessionId: 'sess-2' });
    __listeners.onSessionReconnected({ sessionId: 'sess-2' });
    __listeners.onStreamPropertyChanged({
      sessionId: 'sess-2',
      changedProperty: 'hasAudio',
      oldValue: false,
      newValue: true,
      stream: { streamId: 's1', sessionId: 'sess-2' },
    });
    __listeners.onSessionDisconnected({ sessionId: 'sess-2' });

    Object.values(eventHandlers).forEach((handler) => {
      expect(handler).not.toHaveBeenCalled();
    });
    expect(setIsConnected).not.toHaveBeenCalledWith('sess-2', false);
  });
});
