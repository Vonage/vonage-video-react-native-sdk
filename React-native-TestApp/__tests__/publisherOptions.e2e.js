'use strict';

const { TestSession, poll } = require('./helpers/testSession');

/**
 * Publisher Options Tests
 *
 * Tests various publisher configurations: audio-only, video-only,
 * camera switching, unpublish/republish.
 *
 * These tests don't require a bot — they verify the publisher UI behavior.
 * Session is connected once and stays connected for all tests.
 */
describe('Publisher Options', () => {
  let session;

  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();

    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();

    session = await TestSession.create();
    await session.connectApp();
    console.log('[publisherOptions] Connected.');

    // Wait for publisher to be active
    await poll(() => expect(element(by.id('publisher'))).toExist(), 15000);
    console.log('[publisherOptions] Publisher active.');
  });

  afterAll(async () => {
    await session.teardown();
    await device.terminateApp();
  });

  it('toggle audio off then on (mute/unmute)', async () => {
    await element(by.id('tabPublisher')).tap();
    await element(by.id('hasAudio')).tap();
    console.log('[audio] Muted.');

    await poll(() => expect(element(by.id('publisher'))).toExist(), 5000);

    await element(by.id('hasAudio')).tap();
    console.log('[audio] Unmuted.');
    await poll(() => expect(element(by.id('publisher'))).toExist(), 5000);
  });

  it('toggle video off then on (camera off/on)', async () => {
    await element(by.id('tabPublisher')).tap();
    await element(by.id('hasVideo')).tap();
    console.log('[video] Camera off.');

    await poll(() => expect(element(by.id('publisher'))).toExist(), 5000);

    await element(by.id('hasVideo')).tap();
    console.log('[video] Camera on.');
    await poll(() => expect(element(by.id('publisher'))).toExist(), 5000);
  });

  it('unpublish then republish', async () => {
    await element(by.id('tabSession')).tap();
    await poll(() => expect(element(by.id('stopPublishing'))).toBeVisible(), 5000);
    await element(by.id('stopPublishing')).tap();
    console.log('[unpublish] Unpublished.');

    await poll(() => expect(element(by.id('stopPublishing'))).toBeVisible(), 5000);
    await element(by.id('stopPublishing')).tap();
    console.log('[unpublish] Republished.');
    await poll(() => expect(element(by.id('publisher'))).toExist(), 15000);
    console.log('[unpublish] Publisher exists again.');
  });

  it('publish audio-only (video off)', async () => {
    await element(by.id('tabPublisher')).tap();
    await poll(() => expect(element(by.id('hasVideo'))).toBeVisible(), 5000);
    await element(by.id('hasVideo')).tap();
    await poll(() => expect(element(by.id('publisher'))).toExist(), 5000);
    console.log('[audio-only] Publishing audio only.');

    // Restore
    await element(by.id('hasVideo')).tap();
    await poll(() => expect(element(by.id('publisher'))).toExist(), 5000);
  });

  it('publish video-only (audio off)', async () => {
    await element(by.id('tabPublisher')).tap();
    await element(by.id('hasAudio')).tap();
    await poll(() => expect(element(by.id('publisher'))).toExist(), 5000);
    console.log('[video-only] Publishing video only.');

    // Restore
    await element(by.id('hasAudio')).tap();
    await poll(() => expect(element(by.id('publisher'))).toExist(), 5000);
  });
});
