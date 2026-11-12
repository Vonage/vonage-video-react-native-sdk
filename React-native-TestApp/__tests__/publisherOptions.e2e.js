'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');

const { TestSession } = require('./helpers/testSession');

/**
 * Publisher configurations (audio-only, video-only, camera switching, unpublish/republish).
 * No bots: the session is connected once and stays connected for all tests.
 */
describe('Publisher Options', () => {
  let session;

  beforeAll(async () => {
    await launchAndWaitForApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });

    session = await TestSession.create();
    await session.connectApp();
    console.log('[publisherOptions] Connected.');

    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);
    console.log('[publisherOptions] Publisher active.');
  });

  afterAll(async () => {
    if (session) await session.teardown();
    await device.terminateApp();
  });

  it('toggle audio off then on (mute/unmute)', async () => {
    await element(by.id('tabPublisher')).tap();
    await waitFor(element(by.id('hasAudio'))).toBeVisible().withTimeout(5000);
    await element(by.id('hasAudio')).tap();
    console.log('[audio] Muted.');

    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);

    await element(by.id('hasAudio')).tap();
    console.log('[audio] Unmuted.');
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);
  });

  it('toggle video off then on (camera off/on)', async () => {
    await element(by.id('tabPublisher')).tap();
    await waitFor(element(by.id('hasVideo'))).toBeVisible().withTimeout(5000);
    await element(by.id('hasVideo')).tap();
    console.log('[video] Camera off.');

    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);

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
    await element(by.id('tabPublisher')).tap();
    await waitFor(element(by.id('hasVideo'))).toBeVisible().withTimeout(5000);
    await element(by.id('hasVideo')).tap();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);
    console.log('[audio-only] Publishing audio only.');

    await element(by.id('hasVideo')).tap();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);
  });

  it('publish video-only (audio off)', async () => {
    await element(by.id('tabPublisher')).tap();
    await waitFor(element(by.id('hasAudio'))).toBeVisible().withTimeout(5000);
    await element(by.id('hasAudio')).tap();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);
    console.log('[video-only] Publishing video only.');

    await element(by.id('hasAudio')).tap();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);
  });

  it('sets and reads the target scalability mode through the native module', async () => {
    const modeValue = element(by.id('scalabilityModeValue'));
    await element(by.id('tabPublisher')).tap();
    await waitFor(element(by.id('setScalabilityL1T2')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('setScalabilityL1T2')).tap();
    await element(by.id('getScalabilityMode')).tap();
    await waitFor(modeValue).toHaveText('L1T2').withTimeout(5000);

    await element(by.id('setScalabilityL3T3')).tap();
    await element(by.id('getScalabilityMode')).tap();
    await waitFor(modeValue).toHaveText('L3T3').withTimeout(5000);

    await element(by.id('setScalabilityInvalid')).tap();
    await waitFor(modeValue)
      .toHaveText(
        'error: setTargetScalabilityMode: mode must be one of L1T1, L1T2, L1T3, L2T1, L2T2, L2T3, L3T1, L3T2, L3T3 (got "L9T9").',
      )
      .withTimeout(5000);

    await element(by.id('getScalabilityMode')).tap();
    await waitFor(modeValue).toHaveText('L3T3').withTimeout(5000);
  });
});
