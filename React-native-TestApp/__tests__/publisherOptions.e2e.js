'use strict';

const { TestSession } = require('./helpers/testSession');

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
  const publisherControlTimeout = 10000;

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
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);
    console.log('[publisherOptions] Publisher active.');
  });

  afterAll(async () => {
    await session.teardown();
    await device.terminateApp();
  });

  it('toggle audio off then on (mute/unmute)', async () => {
    await waitFor(element(by.id('tabPublisher')))
      .toBeVisible()
      .withTimeout(publisherControlTimeout);
    await element(by.id('tabPublisher')).tap();
    await waitFor(element(by.id('hasAudio')))
      .toBeVisible()
      .withTimeout(publisherControlTimeout);
    await element(by.id('hasAudio')).tap();
    console.log('[audio] Muted.');

    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);

    await waitFor(element(by.id('hasAudio')))
      .toBeVisible()
      .withTimeout(publisherControlTimeout);
    await element(by.id('hasAudio')).tap();
    console.log('[audio] Unmuted.');
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);
  });

  it('toggle video off then on (camera off/on)', async () => {
    await waitFor(element(by.id('tabPublisher')))
      .toBeVisible()
      .withTimeout(publisherControlTimeout);
    await element(by.id('tabPublisher')).tap();
    await waitFor(element(by.id('hasVideo')))
      .toBeVisible()
      .withTimeout(publisherControlTimeout);
    await element(by.id('hasVideo')).tap();
    console.log('[video] Camera off.');

    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);

    await waitFor(element(by.id('hasVideo')))
      .toBeVisible()
      .withTimeout(publisherControlTimeout);
    await element(by.id('hasVideo')).tap();
    console.log('[video] Camera on.');
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);
  });

  it('unpublish then republish', async () => {
    await element(by.id('tabSession')).tap();
    await waitFor(element(by.id('stopPublishing'))).toBeVisible().withTimeout(5000);
    await element(by.id('stopPublishing')).tap();
    console.log('[unpublish] Unpublished.');

    await waitFor(element(by.id('stopPublishing'))).toBeVisible().withTimeout(5000);
    await element(by.id('stopPublishing')).tap();
    console.log('[unpublish] Republished.');
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);
    console.log('[unpublish] Publisher exists again.');
  });

  it('publish audio-only (video off)', async () => {
    await waitFor(element(by.id('tabPublisher')))
      .toBeVisible()
      .withTimeout(publisherControlTimeout);
    await element(by.id('tabPublisher')).tap();
    await waitFor(element(by.id('hasVideo')))
      .toBeVisible()
      .withTimeout(publisherControlTimeout);
    await element(by.id('hasVideo')).tap();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);
    console.log('[audio-only] Publishing audio only.');

    // Restore
    await waitFor(element(by.id('hasVideo')))
      .toBeVisible()
      .withTimeout(publisherControlTimeout);
    await element(by.id('hasVideo')).tap();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);
  });

  it('publish video-only (audio off)', async () => {
    await waitFor(element(by.id('tabPublisher')))
      .toBeVisible()
      .withTimeout(publisherControlTimeout);
    await element(by.id('tabPublisher')).tap();
    await waitFor(element(by.id('hasAudio')))
      .toBeVisible()
      .withTimeout(publisherControlTimeout);
    await element(by.id('hasAudio')).tap();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);
    console.log('[video-only] Publishing video only.');

    // Restore
    await waitFor(element(by.id('hasAudio')))
      .toBeVisible()
      .withTimeout(publisherControlTimeout);
    await element(by.id('hasAudio')).tap();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);
  });
});
