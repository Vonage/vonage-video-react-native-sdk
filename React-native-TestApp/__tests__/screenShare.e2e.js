'use strict';
const { launchAppWithRetry, waitForAppReady } = require('./helpers/waitForApp');

const { TestSession } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent, clearCapturedEvents } = require('./helpers/eventCapture');
const { pollUntil } = require('./helpers/poll');
const { expect: jestExpect } = require('expect');

/**
 * Screen Sharing Tests
 *
 * Verifies that the RN app can toggle screen sharing on and off,
 * and that a remote bot receives the screen share stream.
 */
describe('Screen Sharing', () => {
  let session;

  beforeAll(async () => {
    session = await TestSession.create();
  });

  beforeEach(async () => {
    await launchAppWithRetry({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();
    await waitForAppReady();
  });

  afterAll(async () => {
    if (session) await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    if (session) await session.cleanup();
  });

  it('screen share toggle publishes a new stream that the bot receives', async () => {
    await session.connectApp();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);
    console.log('[screenShare] Connected and publishing with camera.');

    // Add bot — it subscribes to the initial camera stream
    console.log('[screenShare] Adding bot...');
    const bot = await session.addBot();

    await bot.waitForSubscriber();
    console.log('[screenShare] Bot subscribed to camera stream.');

    // Reset bot streamCreated flag so we can detect the new screen share stream
    await bot.page.evaluate(() => { window.botState.streamCreated = false; });

    // Toggle screen share — this destroys the camera publisher and creates a screen publisher
    await element(by.id('tabSession')).tap();
    await waitFor(element(by.id('toggleScreenShare'))).toBeVisible().withTimeout(5000);
    await element(by.id('toggleScreenShare')).tap();
    console.log('[screenShare] Toggled screen share ON.');

    // Wait for publisher to remount with screen source
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);

    // The toggle destroys the camera stream and creates the screen stream, so
    // subscriberCount alone cannot tell old from new. Wait for the new streamCreated.
    await pollUntil(async () => (await bot.getState()).streamCreated, {
      timeout: 30000,
      label: 'bot to receive the screen share stream',
    });
    const stateAfterToggle = await bot.getState();
    console.log('[screenShare] Bot state after toggle:', JSON.stringify(stateAfterToggle));
    jestExpect(stateAfterToggle.subscriberCount).toBeGreaterThanOrEqual(1);
    jestExpect(stateAfterToggle.streamCreated).toBe(true);
  });

  it('toggling screen share off restores camera publishing to bot', async () => {
    await session.connectApp();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);

    // Add bot
    const bot = await session.addBot();
    await bot.waitForSubscriber();
    await bot.page.evaluate(() => { window.botState.streamCreated = false; });

    // Toggle screen share ON
    await element(by.id('tabSession')).tap();
    await waitFor(element(by.id('toggleScreenShare'))).toBeVisible().withTimeout(5000);
    await element(by.id('toggleScreenShare')).tap();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);
    console.log('[screenShare] Screen share ON.');

    // Wait for the bot to get the screen stream
    await pollUntil(async () => (await bot.getState()).streamCreated, {
      timeout: 30000,
      label: 'bot to receive the screen share stream',
    });

    // Reset streamCreated flag to detect the camera stream after toggle off
    await bot.page.evaluate(() => { window.botState.streamCreated = false; });

    // Toggle screen share OFF (back to camera)
    await element(by.id('tabSession')).tap();
    await waitFor(element(by.id('toggleScreenShare'))).toBeVisible().withTimeout(5000);
    await element(by.id('toggleScreenShare')).tap();
    console.log('[screenShare] Toggled screen share OFF.');

    // Publisher should remount with camera
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);

    // Bot should receive the new camera stream
    await pollUntil(async () => (await bot.getState()).streamCreated, {
      timeout: 30000,
      label: 'bot to receive the camera stream after toggle off',
    });
    const stateAfterRevert = await bot.getState();
    console.log('[screenShare] Bot state after revert:', JSON.stringify(stateAfterRevert));
    jestExpect(stateAfterRevert.subscriberCount).toBeGreaterThanOrEqual(1);
    jestExpect(stateAfterRevert.streamCreated).toBe(true);
  });
});
