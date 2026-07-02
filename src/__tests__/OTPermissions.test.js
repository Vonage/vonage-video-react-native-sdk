// OT.js imports NativeOpentok (a TurboModule) at load; stub it so the module loads under jest.
jest.mock('../NativeOpentok', () => ({ __esModule: true, default: {} }));

jest.mock('react-native', () => ({
  PermissionsAndroid: {
    PERMISSIONS: {
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
      CAMERA: 'android.permission.CAMERA',
      BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
    },
    requestMultiple: jest.fn(),
  },
  Platform: { OS: 'android', Version: 31 },
}));

import { PermissionsAndroid, Platform } from 'react-native';
import { checkAndroidPermissions } from '../OT';

describe('checkAndroidPermissions — BLUETOOTH_CONNECT on Android 12+', () => {
  beforeEach(() => {
    PermissionsAndroid.requestMultiple.mockReset();
    PermissionsAndroid.requestMultiple.mockResolvedValue({
      'android.permission.RECORD_AUDIO': 'granted',
      'android.permission.CAMERA': 'granted',
      'android.permission.BLUETOOTH_CONNECT': 'granted',
    });
  });

  it('requests BLUETOOTH_CONNECT alongside RECORD_AUDIO on API 31+ when audio is enabled', async () => {
    Platform.Version = 31;
    await checkAndroidPermissions(/*audio*/ true, /*video*/ true, /*screen*/ false);
    const requested = PermissionsAndroid.requestMultiple.mock.calls[0][0];
    expect(requested).toEqual([
      'android.permission.RECORD_AUDIO',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.CAMERA',
    ]);
  });

  it('does NOT request BLUETOOTH_CONNECT below API 31', async () => {
    Platform.Version = 30;
    await checkAndroidPermissions(/*audio*/ true, /*video*/ false, /*screen*/ false);
    const requested = PermissionsAndroid.requestMultiple.mock.calls[0][0];
    expect(requested).not.toContain('android.permission.BLUETOOTH_CONNECT');
  });

  it('does NOT request BLUETOOTH_CONNECT when audio is disabled', async () => {
    Platform.Version = 33;
    await checkAndroidPermissions(/*audio*/ false, /*video*/ true, /*screen*/ false);
    const requested = PermissionsAndroid.requestMultiple.mock.calls[0][0];
    expect(requested).not.toContain('android.permission.BLUETOOTH_CONNECT');
  });
});
