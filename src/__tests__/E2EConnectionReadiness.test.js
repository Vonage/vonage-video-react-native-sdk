const {
  TestSession,
} = require('../../React-native-TestApp/__tests__/helpers/testSession');

jest.mock(
  '../../React-native-TestApp/__tests__/helpers/jsSDKTesterBot',
  () => ({
    jsSDKTesterBot: jest.fn(),
  })
);
jest.mock('../../React-native-TestApp/__tests__/helpers/eventCapture', () => ({
  clearCapturedEvents: jest.fn(),
}));

describe('E2E connection readiness', () => {
  let submitted;
  let connected;
  let confirmConnection;
  let failConnection;
  let connectionWait;
  let disconnectError;

  beforeEach(() => {
    submitted = false;
    connected = false;
    disconnectError = null;
    connectionWait = new Promise((resolve, reject) => {
      confirmConnection = () => {
        connected = true;
        resolve();
      };
      failConnection = reject;
    });
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
    });
    global.waitFor = ({ id }) => {
      const matcher = {
        toBeVisible: () => ({
          withTimeout: async () => {
            if (id === 'disconnectSession' && !submitted)
              throw new Error('Not mounted');
          },
        }),
        not: {
          toHaveText: () => ({ withTimeout: () => connectionWait }),
        },
      };
      return matcher;
    };
  });

  afterEach(() => {
    delete global.by;
    delete global.element;
    delete global.waitFor;
  });

  it.each(['connectApp', 'connectAppWithCredentials'])(
    '%s waits for SDK connection confirmation despite an optimistic Disconnect button',
    async (method) => {
      const session = new TestSession({
        credentials: {
          apiKey: 'test-key',
          sessionId: 'test-session',
          tokenApp: 'test-token',
        },
      });
      let completed = false;
      const connection = session[method](
        'test-key',
        'test-session',
        'test-token'
      ).then(() => {
        completed = true;
      });

      await new Promise(setImmediate);
      expect(submitted).toBe(true);
      expect(connected).toBe(false);
      expect(completed).toBe(false);

      confirmConnection();
      await connection;
      expect(completed).toBe(true);
    }
  );

  it.each(['connectApp', 'connectAppWithCredentials'])(
    '%s rejects when the SDK does not confirm the connection',
    async (method) => {
      const session = new TestSession({
        credentials: {
          apiKey: 'test-key',
          sessionId: 'test-session',
          tokenApp: 'test-token',
        },
      });
      const connection = session[method](
        'test-key',
        'test-session',
        'test-token'
      );

      await new Promise(setImmediate);
      expect(submitted).toBe(true);
      expect(connected).toBe(false);

      failConnection(new Error('session not connected'));
      await expect(connection).rejects.toThrow('session not connected');
    }
  );

  it('disconnectApp finishes when the disconnect control cannot be used', async () => {
    disconnectError = new Error('disconnect failed');
    const session = new TestSession({
      credentials: {
        apiKey: 'test-key',
        sessionId: 'test-session',
        tokenApp: 'test-token',
      },
    });

    await expect(session.disconnectApp()).resolves.toBeUndefined();
  });
});
