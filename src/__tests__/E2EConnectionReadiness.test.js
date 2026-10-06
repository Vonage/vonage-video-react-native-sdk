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
  let sdkConfirmation;

  beforeEach(() => {
    submitted = false;
    connected = false;
    sdkConfirmation = new Promise((resolve) => {
      confirmConnection = () => {
        connected = true;
        resolve();
      };
    });
    global.by = { id: (id) => id };
    global.element = (id) => ({
      id,
      tap: async () => {
        if (id === 'disconnectSession' && !submitted)
          throw new Error('Not mounted');
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
          toHaveText: () => ({ withTimeout: () => sdkConfirmation }),
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
});
