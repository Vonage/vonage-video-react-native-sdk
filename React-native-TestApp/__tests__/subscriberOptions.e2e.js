'use strict';

const { TestSession, poll } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent, clearCapturedEvents } = require('./helpers/eventCapture');
const { expect: jestExpect } = require('expect');

/**
 * Subscriber Options Tests
 *
 * Tests subscriber behavior with various configurations and multi-bot scenarios.
 * Organized into two groups by topology:
 *   - Single bot (relayed): toggle video/audio, unsubscribe/resubscribe, volume
 *   - Multi bot (routed): multiple subscribers, disconnect behavior
 */
describe('Subscriber Options', () => {
  let session;

  beforeAll(async () => {
    console.log('[subscriberOptions] Launching app...');
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();

    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();
    console.log('[subscriberOptions] App ready.');

    session = await TestSession.create();
  });

  afterAll(async () => {
    await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    await session.cleanup();
  });

  describe('single bot scenarios (relayed)', () => {
    it('subscriber appears when bot publishes', async () => {
      await session.connectApp();

      await setCaptureFilter(['streamCreated', 'connectionCreated']);

      // addBot() waits for subscriber to appear
      await session.addBot();
      console.log('[sub] Subscriber visible.');

      // Verify event indicators
      await waitFor(element(by.id('session-streamCreated'))).not.toHaveText('0').withTimeout(5000);
      await waitFor(element(by.id('session-connectionCreated'))).not.toHaveText('0').withTimeout(5000);

      // Verify streamCreated payload
      const streamEvent = await waitForEvent('streamCreated');
      jestExpect(streamEvent.streamId).toBeTruthy();
      jestExpect(typeof streamEvent.streamId).toBe('string');

      // Verify connectionCreated payload
      const connEvent = await waitForEvent('connectionCreated');
      jestExpect(connEvent.connectionId).toBeTruthy();
      jestExpect(typeof connEvent.connectionId).toBe('string');
    });

    it('toggle subscribeToVideo off and on', async () => {
      await session.connectApp();
      await session.addBot();

      // Toggle video off
      await element(by.id('tabSubscriber')).tap();
      await element(by.id('toggleSubscribeVideo')).tap();
      console.log('[subVideo] Toggled subscribeToVideo off.');

      // Subscriber should still exist (audio-only now)
      await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);

      // Toggle video back on
      await element(by.id('toggleSubscribeVideo')).tap();
      console.log('[subVideo] Toggled subscribeToVideo on.');
      await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
      console.log('[subVideo] Subscribe video toggle works.');
    });

    it('toggle subscribeToAudio off and on', async () => {
      await session.connectApp();
      await session.addBot();

      // Toggle audio off
      await element(by.id('tabSubscriber')).tap();
      await element(by.id('toggleSubscribeAudio')).tap();
      console.log('[subAudio] Toggled subscribeToAudio off (video-only).');
      await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);

      // Toggle audio back on
      await element(by.id('toggleSubscribeAudio')).tap();
      console.log('[subAudio] Toggled subscribeToAudio on.');
      await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
      console.log('[subAudio] Subscribe audio toggle works.');
    });

    it('unsubscribe removes subscriber view', async () => {
      await session.connectApp();
      await session.addBot();

      // Unsubscribe
      await element(by.id('tabSubscriber')).tap();
      await element(by.id('unsubscribe')).tap();
      console.log('[unsubscribe] Tapped unsubscribe.');

      // Wait for subscriber to disappear
      await waitFor(element(by.id('subscriber'))).not.toExist().withTimeout(5000);
      console.log('[unsubscribe] Subscriber view removed.');
    });

    it('resubscribe restores subscriber view', async () => {
      await session.connectApp();
      await session.addBot();

      // Unsubscribe first
      await element(by.id('tabSubscriber')).tap();
      await element(by.id('unsubscribe')).tap();
      await waitFor(element(by.id('subscriber'))).not.toExist().withTimeout(5000);

      // Resubscribe
      await element(by.id('resubscribe')).tap();
      console.log('[resubscribe] Tapped resubscribe.');

      // Subscriber view should reappear
      await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
      console.log('[resubscribe] Subscriber view restored.');
    });

    it('set volume to 0 does not crash', async () => {
      await session.connectApp();
      await session.addBot();

      // Set volume to 0
      await element(by.id('tabSubscriber')).tap();
      await element(by.id('setVolume0')).tap();
      console.log('[volume0] Set volume to 0.');
      await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
      console.log('[volume0] Subscriber still exists after volume 0.');
    });

    it('set volume to 50 does not crash', async () => {
      await session.connectApp();
      await session.addBot();

      // Set volume to 50
      await element(by.id('tabSubscriber')).tap();
      await element(by.id('setVolume50')).tap();
      console.log('[volume50] Set volume to 50.');
      await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
      console.log('[volume50] Subscriber still exists after volume 50.');
    });
  });

  describe('multi-bot scenarios (routed)', () => {
    it('multiple subscribers with two bots', async () => {
      await session.connectApp();

      await session.addBot();
      console.log('[multi] Bot1 joined.');

      await session.addBot();
      console.log('[multi] Bot2 joined.');

      await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
      console.log('[multi] Subscriber visible with 2 bots.');
    });

    it('subscriber persists after one bot disconnects', async () => {
      await session.connectApp();

      const bot1 = await session.addBot();
      console.log('[persist] Bot1 joined.');

      const bot2 = await session.addBot();
      console.log('[persist] Bot2 joined.');

      // Disconnect bot2
      await bot2.disconnect();
      console.log('[persist] Bot2 disconnected.');

      // Subscriber should still exist (bot1 is still publishing)
      await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
      console.log('[persist] Subscriber still visible after bot2 left.');
    });

    it('subscriber disappears when last bot disconnects', async () => {
      await session.connectApp();

      const bot1 = await session.addBot();
      console.log('[disappear] Bot1 joined.');

      const bot2 = await session.addBot();
      console.log('[disappear] Bot2 joined and receiving app stream.');

      // Disconnect bot2 first
      await bot2.disconnect();
      console.log('[disappear] Bot2 disconnected.');

      // Disconnect bot1 (last one)
      await bot1.disconnect();
      console.log('[disappear] Bot1 disconnected (last bot).');

      // Use controlled polling (2s interval) instead of Detox's aggressive
      // waitFor().not.toExist() (~100ms) to avoid main thread saturation
      // during WebRTC teardown
      await poll(() => expect(element(by.id('subscriber'))).not.toExist(), 30000);
      console.log('[disappear] Subscriber gone after all bots disconnected.');
    });
  });
});
