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
 * Scrolls to make an element visible and taps it.
 * Handles the case where controls are below the video area.
 */
async function scrollAndTap(testID) {
  try {
    await element(by.id(testID)).tap();
  } catch (e) {
    // Element not hittable — scroll down and retry
    await element(by.id('mainScrollView')).swipe('up', 'slow', 0.3);
    await new Promise((resolve) => setTimeout(resolve, 500));
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
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Connect to session
    await expect(element(by.id('submitButton'))).toBeVisible();
    await element(by.id('submitButton')).tap();
    console.log('[publisherOptions] Connecting...');
    await new Promise((resolve) => setTimeout(resolve, 30000));
    await expect(element(by.id('disconnectSession'))).toBeVisible();
    console.log('[publisherOptions] Connected. Scrolling to controls...');

    // Scroll to make controls visible
    await element(by.id('mainScrollView')).swipe('up', 'slow', 0.5);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterAll(async () => {});

  it('toggle audio off then on (mute/unmute)', async () => {
    await scrollAndTap('hasAudio');
    console.log('[audio] Muted.');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await scrollAndTap('hasAudio');
    console.log('[audio] Unmuted.');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await expect(element(by.id('publisher'))).toExist();
  });

  it('toggle video off then on (camera off/on)', async () => {
    await scrollAndTap('hasVideo');
    console.log('[video] Camera off.');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await scrollAndTap('hasVideo');
    console.log('[video] Camera on.');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await expect(element(by.id('publisher'))).toExist();
  });

  it('switch camera front to back and back to front', async () => {
    await scrollAndTap('toggleCameraPosition');
    console.log('[camera] Switched.');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await scrollAndTap('toggleCameraPosition');
    console.log('[camera] Switched back.');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await expect(element(by.id('publisher'))).toExist();
  });

  it('unpublish then republish', async () => {
    await scrollAndTap('stopPublishing');
    console.log('[unpublish] Unpublished.');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await scrollAndTap('stopPublishing');
    console.log('[unpublish] Republished.');
    await new Promise((resolve) => setTimeout(resolve, 8000));
    await expect(element(by.id('publisher'))).toExist();
    console.log('[unpublish] Publisher exists again.');
  });

  it('publish audio-only (video off)', async () => {
    await scrollAndTap('hasVideo');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await expect(element(by.id('publisher'))).toExist();
    console.log('[audio-only] Publishing audio only.');

    // Restore
    await scrollAndTap('hasVideo');
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  it('publish video-only (audio off)', async () => {
    await scrollAndTap('hasAudio');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await expect(element(by.id('publisher'))).toExist();
    console.log('[video-only] Publishing video only.');

    // Restore
    await scrollAndTap('hasAudio');
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });
});
