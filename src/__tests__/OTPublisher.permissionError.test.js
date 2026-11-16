// Regression tests for #190: Android permission denial reaches eventHandlers.error.

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  View: ({ children }) => children ?? null,
}));
jest.mock('../OT', () => ({
  OT: { publish: jest.fn() },
  checkAndroidPermissions: jest.fn(),
}));
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

import { checkAndroidPermissions } from '../OT';
import OTPublisher from '../OTPublisher';

const permissionsError = {
  type: 'Permissions error',
  permissionsDenied: ['android.permission.CAMERA'],
};

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const makePublisher = (error) => {
  const publisher = new OTPublisher({ eventHandlers: { error }, properties: {} });
  publisher.context = { sessionId: 'sid-1' };
  publisher.setState = jest.fn();
  return publisher;
};

describe('OTPublisher permission-denial error routing', () => {
  beforeEach(() => {
    checkAndroidPermissions.mockReset();
  });

  it('dispatches to the current props.eventHandlers.error after a re-render', async () => {
    let rejectPermissions;
    checkAndroidPermissions.mockReturnValue(
      new Promise((_, reject) => {
        rejectPermissions = reject;
      })
    );
    const errorA = jest.fn();
    const errorB = jest.fn();
    const publisher = makePublisher(errorA);

    publisher.props = { ...publisher.props, eventHandlers: { error: errorB } };
    rejectPermissions(permissionsError);
    await flush();

    expect(errorB).toHaveBeenCalledWith(permissionsError);
    expect(errorA).not.toHaveBeenCalled();
  });

  it('reports a denial once when both permission checks reject', async () => {
    checkAndroidPermissions.mockRejectedValue(permissionsError);
    const error = jest.fn();
    const publisher = makePublisher(error);
    await flush();

    publisher.onSessionConnected();
    await flush();

    expect(checkAndroidPermissions).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
