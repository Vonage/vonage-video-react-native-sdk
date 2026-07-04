// Regression test for PR #192 review: the Android permission-denial .catch must
// surface the error to the CURRENT props.eventHandlers.error (not a stale cached
// reference), matching the render onError path.

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  View: ({ children }) => children ?? null,
}));
jest.mock('../OT', () => ({
  OT: { publish: jest.fn() },
  checkAndroidPermissions: jest.fn(() => Promise.reject(new Error('permission denied'))),
}));
jest.mock(
  'deprecated-react-native-prop-types',
  () => ({ ViewPropTypes: { style: () => null } }),
  { virtual: true }
);
jest.mock('react-native-uuid', () => ({ v4: () => 'pub-uuid-1' }));
jest.mock('../OTPublisherNativeComponent', () => 'OTRNPublisher');
jest.mock('../helpers/OTPublisherHelper', () => ({
  sanitizeProperties: () => ({ audioTrack: true, videoTrack: true, videoSource: 'camera' }),
}));
jest.mock('../helpers/OTSessionHelper', () => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  isConnected: jest.fn(() => false),
  getPublisherStream: jest.fn(() => null),
}));

import OTPublisher from '../OTPublisher';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('OTPublisher permission-denial error routing', () => {
  it('dispatches to the current props.eventHandlers.error after a re-render', async () => {
    const errA = jest.fn();
    const errB = jest.fn();

    const pub = new OTPublisher({ eventHandlers: { error: errA }, properties: {} });
    pub.context = { sessionId: 'sid-1' };
    pub.setState = jest.fn();

    // Let the constructor's initComponent permission .catch settle, then reset.
    await flush();
    errA.mockClear();
    errB.mockClear();

    // Parent re-renders with a new error handler.
    pub.props = { ...pub.props, eventHandlers: { error: errB } };

    pub.onSessionConnected();
    await flush();

    expect(errB).toHaveBeenCalledWith(expect.any(Error));
    expect(errA).not.toHaveBeenCalled();
  });
});
