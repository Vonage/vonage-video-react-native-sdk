'use strict';

const { TestSession } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent, clearCapturedEvents } = require('./helpers/eventCapture');
const { expect: jestExpect } = require('expect');

/**
 * Screen Sharing Tests
 *
 * Verifies that the RN app can toggle screen sharing on and off,
 * and that a remote bot receives the screen share stream.
 */
describe.skip('Screen Sharing', () => {
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
  });

  afterAll(async () => {
    await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    await session.cleanup();
  });

  it('screen share toggle publishes a new stream that the bot receives', async () => {
    await session.connectApp();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);
    console.log('[screenShare] Connected and publishing with camera.');

    // Add bot — it subscribes to the initial camera stream
    console.log('[screenShare] Adding bot...');
    const bot = await session.addBot();

    const stateBeforeToggle = await bot.getState();
    jestExpect(stateBeforeToggle.subscriberCount).toBeGreaterThanOrEqual(1);
    console.log('[screenShare] Bot subscribed to camera stream.');

    // Reset bot streamCreated flag so we can detect the new screen share stream
    await bot.page.evaluate(() => { window.botState.streamCreated = false; });

    // Toggle screen share — this destroys the camera publisher and creates a screen publisher
    await element(by.id('tabSession')).tap();
    await waitFor(element(by.id('toggleScreenShare'))).toBeVisible().withTimeout(15000);
    await element(by.id('toggleScreenShare')).tap();
    console.log('[screenShare] Toggled screen share ON.');

    // Wait for publisher to remount with screen source
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);

    // Wait for the bot to receive the new screen share stream.
    // The toggle causes streamDestroyed (camera) then streamCreated (screen),
    // so subscriberCount drops to 0 briefly before going back to 1.
    console.log('[screenShare] Waiting for bot to receive screen share stream...');
    try {
      await bot.waitForSubscriber(30000);
    } catch (e) {
      const state = await bot.getState();
      console.log('[screenShare] Bot state at timeout:', JSON.stringify(state));
      throw new Error(
        `Bot did not receive screen share stream within 30s. State: ${JSON.stringify(state)}`
      );
    }

    // Verify bot received a NEW streamCreated (not just the old camera one)
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
    const stateInitial = await bot.getState();
    jestExpect(stateInitial.subscriberCount).toBeGreaterThanOrEqual(1);

    // Toggle screen share ON
    await element(by.id('tabSession')).tap();
    await waitFor(element(by.id('toggleScreenShare'))).toBeVisible().withTimeout(15000);
    await element(by.id('toggleScreenShare')).tap();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);
    console.log('[screenShare] Screen share ON.');

    // Wait for bot to get the screen stream
    try {
      await bot.waitForSubscriber(30000);
    } catch (_) {}

    // Reset streamCreated flag to detect the camera stream after toggle off
    await bot.page.evaluate(() => { window.botState.streamCreated = false; });

    // Toggle screen share OFF (back to camera)
    await element(by.id('tabSession')).tap();
    await waitFor(element(by.id('toggleScreenShare'))).toBeVisible().withTimeout(15000);
    await element(by.id('toggleScreenShare')).tap();
    console.log('[screenShare] Toggled screen share OFF.');

    // Publisher should remount with camera
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);

    // Bot should receive the new camera stream
    try {
      await bot.waitForSubscriber(30000);
    } catch (e) {
      const state = await bot.getState();
      throw new Error(
        `Bot did not receive camera stream after toggle off within 30s. State: ${JSON.stringify(state)}`
      );
    }

    const stateAfterRevert = await bot.getState();
    console.log('[screenShare] Bot state after revert:', JSON.stringify(stateAfterRevert));
    jestExpect(stateAfterRevert.subscriberCount).toBeGreaterThanOrEqual(1);
    jestExpect(stateAfterRevert.streamCreated).toBe(true);
  });
});
