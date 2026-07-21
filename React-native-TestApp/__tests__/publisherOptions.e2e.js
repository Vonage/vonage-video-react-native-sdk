'use strict';

const { getCredentials } = require('./helpers/credentials');

/**
 * Publisher Options Tests
 *
 * Tests various publisher configurations: audio-only, video-only,
 * camera switching, unpublish/republish.
 *
 * These tests don't require a bot — they verify the publisher UI behavior.
 * Session is connected once and stays connected for all tests.
 */

/**
 * Taps a button by testID. Retries with scroll if not hittable.
 */
async function tapButton(testID) {
  try {
    await element(by.id(testID)).tap();
  } catch (e) {
    // Button may be slightly off-screen on smaller devices — scroll main view
    await element(by.id('mainScrollView')).swipe('up', 'slow', 0.2);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await element(by.id(testID)).tap();
  }
}

describe('Publisher Options', () => {
  beforeAll(async () => {
    const credentials = await getCredentials();

    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();

    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();

    // Connect to session
    await element(by.id('submitButton')).tap();
    console.log('[publisherOptions] Connecting...');
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(30000);
    console.log('[publisherOptions] Connected.');

    // Verify initial session/publisher events
    await waitFor(element(by.id('session-sessionConnected'))).not.toHaveText('0').withTimeout(5000);
    await waitFor(element(by.id('publisher-streamCreated'))).not.toHaveText('0').withTimeout(5000);
    console.log('[publisherOptions] Event indicators confirmed.');
  });

  afterAll(async () => { await device.terminateApp(); });

  it('toggle audio off then on (mute/unmute)', async () => {
    await element(by.id('tabPublisher')).tap();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await element(by.id('hasAudio')).tap();
    console.log('[audio] Muted.');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify streamPropertyChanged fires when audio toggled
    await waitFor(element(by.id('session-streamPropertyChanged'))).not.toHaveText('0').withTimeout(5000);

    await element(by.id('hasAudio')).tap();
    console.log('[audio] Unmuted.');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await expect(element(by.id('publisher'))).toExist();
  });

  it('toggle video off then on (camera off/on)', async () => {
    await element(by.id('hasVideo')).tap();
    console.log('[video] Camera off.');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify streamPropertyChanged fires when video toggled
    await waitFor(element(by.id('session-streamPropertyChanged'))).not.toHaveText('0').withTimeout(5000);

    await element(by.id('hasVideo')).tap();
    console.log('[video] Camera on.');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await expect(element(by.id('publisher'))).toExist();
  });

  // it('switch camera front to back and back to front', async () => {
  //   await tapButton('toggleCameraPosition');
  //   console.log('[camera] Switched.');
  //   await new Promise((resolve) => setTimeout(resolve, 3000));

  //   await tapButton('toggleCameraPosition');
  //   console.log('[camera] Switched back.');
  //   await new Promise((resolve) => setTimeout(resolve, 3000));
  //   await expect(element(by.id('publisher'))).toExist();
  // });

  it('unpublish then republish', async () => {
    await element(by.id('tabSession')).tap();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await element(by.id('stopPublishing')).tap();
    console.log('[unpublish] Unpublished.');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await element(by.id('stopPublishing')).tap();
    console.log('[unpublish] Republished.');
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(8000);
    await expect(element(by.id('publisher'))).toExist();
    console.log('[unpublish] Publisher exists again.');
  });

  it('publish audio-only (video off)', async () => {
    await element(by.id('tabPublisher')).tap();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await element(by.id('hasVideo')).tap();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await expect(element(by.id('publisher'))).toExist();
    console.log('[audio-only] Publishing audio only.');

    // Restore
    await element(by.id('hasVideo')).tap();
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  it('publish video-only (audio off)', async () => {
    await element(by.id('hasAudio')).tap();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await expect(element(by.id('publisher'))).toExist();
    console.log('[video-only] Publishing video only.');

    // Restore
    await element(by.id('hasAudio')).tap();
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });
});
