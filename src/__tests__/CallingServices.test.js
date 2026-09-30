jest.mock('../NativeOpentok', () => ({
  __esModule: true,
  default: Object.fromEntries(
    [
      'isCallingServicesModeAvailable',
      'enableCallingServicesMode',
      'preconfigureAudioSessionForCall',
      'notifyAudioSessionActivated',
      'notifyAudioSessionDeactivated',
      'setRequestAudioFocus',
      'notifyAudioFocusActivated',
      'notifyAudioFocusDeactivated',
    ].map((name) => [name, jest.fn()])
  ),
}));
jest.mock('../OTPublisher', () => ({ __esModule: true, default: {} }));
jest.mock('../OTSession', () => ({ __esModule: true, default: {} }));
jest.mock('../OTSubscriber', () => ({ __esModule: true, default: {} }));
jest.mock('../OTSubscriberView', () => ({ __esModule: true, default: {} }));

import NativeOpentok from '../NativeOpentok';
import * as API from '../index';

describe('public calling-services API', () => {
  it.each(Object.keys(NativeOpentok))(
    '%s forwards the native Promise',
    (name) => {
      const args =
        name === 'setRequestAudioFocus'
          ? [false]
          : name === 'preconfigureAudioSessionForCall'
            ? ['voiceChat']
            : [];
      const result = Promise.resolve(name === 'isCallingServicesModeAvailable');
      NativeOpentok[name].mockReturnValue(result);
      expect(API[name](...args)).toBe(result);
      expect(NativeOpentok[name]).toHaveBeenCalledWith(...args);
    }
  );

  it('defaults audio preconfiguration to videoChat', () => {
    API.preconfigureAudioSessionForCall();
    expect(NativeOpentok.preconfigureAudioSessionForCall).toHaveBeenCalledWith(
      'videoChat'
    );
  });

  it('preserves native rejection', async () => {
    const error = new Error('CALLING_SERVICES_UNAVAILABLE');
    NativeOpentok.enableCallingServicesMode.mockRejectedValue(error);
    await expect(API.enableCallingServicesMode()).rejects.toBe(error);
  });
});
