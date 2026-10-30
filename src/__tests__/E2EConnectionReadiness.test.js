const {
  TestSession,
} = require('../../React-native-TestApp/__tests__/helpers/testSession');
const {
  getLastEvent,
} = require('../../React-native-TestApp/__tests__/helpers/eventCapture');

jest.mock(
  '../../React-native-TestApp/__tests__/helpers/jsSDKTesterBot',
  () => ({
    jsSDKTesterBot: jest.fn(),
  })
);
jest.mock('../../React-native-TestApp/__tests__/helpers/eventCapture', () => ({
  clearCapturedEvents: jest.fn(),
  getLastEvent: jest.fn(),
}));

const credentials = {
  apiKey: 'test-key',
  sessionId: 'test-session',
  tokenApp: 'test-token',
};

describe('E2E connection readiness', () => {
  let submitted;
  let counters;
  let disconnectError;

  beforeEach(() => {
    jest.useFakeTimers();
    submitted = false;
    disconnectError = null;
    counters = {
      'session-sessionConnected': '0',
      'session-error': '0',
    };
    getLastEvent.mockReset();
    global.by = { id: (id) => id };
    global.element = (id) => ({
      id,
      tap: async () => {
        if (id === 'disconnectSession') {
          if (disconnectError) throw disconnectError;
          if (!submitted) throw new Error('Not mounted');
        }
        if (id === 'submitButton') submitted = true;
      },
      replaceText: async () => {},
      getAttributes: async () => ({ text: counters[id] || '0' }),
    });
    global.waitFor = ({ id }) => ({
      toBeVisible: () => ({
        withTimeout: async () => {
          if (id === 'disconnectSession' && !submitted)
            throw new Error('Not mounted');
        },
      }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.by;
    delete global.element;
    delete global.waitFor;
  });

  function session() {
    return new TestSession({ credentials });
  }

  it('connectApp waits until the SDK reports the session as connected', async () => {
    let completed = false;
    const connection = session()
      .connectApp()
      .then(() => {
        completed = true;
      });

    await jest.advanceTimersByTimeAsync(0);
    expect(submitted).toBe(true);
    expect(completed).toBe(false);

    counters['session-sessionConnected'] = '1';
    await jest.advanceTimersByTimeAsync(500);
    await connection;
    expect(completed).toBe(true);
  });

  it('connectApp rejects when the session reports an error', async () => {
    counters['session-error'] = '1';
    getLastEvent.mockResolvedValue({
      code: 1006,
      message: 'authentication failed',
    });

    const connection = session().connectApp();
    const assertion = expect(connection).rejects.toThrow(
      'The app failed to connect to the session (code 1006: authentication failed)'
    );
    await jest.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(getLastEvent).toHaveBeenCalledWith('sessionError');
  });

  it('connectApp rejects when the session never connects', async () => {
    const connection = session().connectApp();
    const assertion = expect(connection).rejects.toThrow(
      'The app did not connect to the session within 30000ms'
    );
    await jest.advanceTimersByTimeAsync(30000);
    await assertion;
  });

  it('disconnectApp finishes when the disconnect control cannot be used', async () => {
    disconnectError = new Error('disconnect failed');
    await expect(session().disconnectApp()).resolves.toBeUndefined();
  });
});
