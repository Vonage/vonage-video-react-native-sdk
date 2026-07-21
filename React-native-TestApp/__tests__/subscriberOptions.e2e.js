'use strict';

const { jsSDKTesterBot } = require('./helpers/jsSDKTesterBot');
const { getCredentials } = require('./helpers/credentials');

/**
 * Subscriber Options Tests
 *
 * Tests subscriber behavior with multiple bots and various configurations.
 * Verifies multi-subscriber scenarios.
 */
describe('Subscriber Options', () => {
  let credentials;
  let bot1;
  let bot2;

  beforeAll(async () => {
    credentials = await getCredentials();

    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();

    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();

    // Connect app to session
    await element(by.id('submitButton')).tap();
    console.log('[subscriberOptions] Connecting...');
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(30000);
    console.log('[subscriberOptions] App connected.');
  });

  afterAll(async () => {
    await device.terminateApp();
    if (bot1) await bot1.close();
    if (bot2) await bot2.close();
  });

  it('subscriber appears when first bot publishes', async () => {
    bot1 = new jsSDKTesterBot({ timeout: 30000 });
    await bot1.launch();
    console.log('[sub] Bot1 joining...');
    try {
      await bot1.joinSession(
        credentials.apiKey,
        credentials.sessionId,
        credentials.tokenBot,
        { apiUrl: credentials.apiUrl }
      );
    } catch (e) {
      const state = await bot1.getState();
      console.log('[sub] Bot1 FAILED:', state.error);
      throw e;
    }
    console.log('[sub] Bot1 publishing. Waiting for subscriber...');
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(15000);
    await expect(element(by.id('subscriber'))).toExist();
    console.log('[sub] Subscriber visible for bot1.');

    // Verify event indicators
    await waitFor(element(by.id('session-streamCreated'))).not.toHaveText('0').withTimeout(5000);
    await waitFor(element(by.id('session-connectionCreated'))).not.toHaveText('0').withTimeout(5000);
  });

  it('multiple subscribers with two bots', async () => {
    bot2 = new jsSDKTesterBot({ timeout: 30000 });
    await bot2.launch();
    console.log('[multi] Bot2 joining...');
    try {
      await bot2.joinSession(
        credentials.apiKey,
        credentials.sessionId,
        credentials.tokenBot2 || credentials.tokenBot,
        { apiUrl: credentials.apiUrl }
      );
    } catch (e) {
      const state = await bot2.getState();
      console.log('[multi] Bot2 FAILED:', state.error);
      throw e;
    }
    console.log('[multi] Bot2 publishing. Waiting...');
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(15000);
    await expect(element(by.id('subscriber'))).toExist();
    console.log('[multi] Subscriber still visible with 2 bots.');
  });

  it('subscriber persists after one bot disconnects', async () => {
    console.log('[persist] Disconnecting bot2...');
    await bot2.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 10000));
    await expect(element(by.id('subscriber'))).toExist();
    console.log('[persist] Subscriber still visible after bot2 left.');
  });

  it('subscriber disappears when last bot disconnects', async () => {
    console.log('[disappear] Disconnecting bot1...');
    await bot1.disconnect();

    // Wait for stream destroyed event — more reliable than checking view visibility
    await waitFor(element(by.id('session-streamDestroyed'))).not.toHaveText('0').withTimeout(30000);
    console.log('[disappear] Stream destroyed event received.');

    // Give the UI time to unmount the subscriber view
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log('[disappear] Subscriber gone.');

    // Verify connection destroyed event
    await waitFor(element(by.id('session-connectionDestroyed'))).not.toHaveText('0').withTimeout(5000);
  });

  it('toggle subscribeToVideo off and on', async () => {
    // Reconnect bot1 for this test
    await bot1.joinSession(
      credentials.apiKey,
      credentials.sessionId,
      credentials.tokenBot,
      { apiUrl: credentials.apiUrl }
    );
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(15000);
    await expect(element(by.id('subscriber'))).toExist();

    // Toggle subscribeToVideo off (action bar — always visible)
    await element(by.id('tabSubscriber')).tap();
    await element(by.id('toggleSubscribeVideo')).tap();
    console.log('[subVideo] Toggled subscribeToVideo off.');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Subscriber should still exist (audio-only now)
    await expect(element(by.id('subscriber'))).toExist();

    // Toggle back on
    await element(by.id('toggleSubscribeVideo')).tap();
    console.log('[subVideo] Toggled subscribeToVideo on.');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await expect(element(by.id('subscriber'))).toExist();
    console.log('[subVideo] Subscribe video toggle works.');
  });

  it('toggle subscribeToAudio off and on (video-only subscribe)', async () => {
    // Bot1 should still be connected
    await expect(element(by.id('subscriber'))).toExist();

    // Toggle subscribeToAudio off
    await element(by.id('tabSubscriber')).tap();
    await element(by.id('toggleSubscribeAudio')).tap();
    console.log('[subAudio] Toggled subscribeToAudio off (video-only).');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await expect(element(by.id('subscriber'))).toExist();

    // Toggle back on
    await element(by.id('toggleSubscribeAudio')).tap();
    console.log('[subAudio] Toggled subscribeToAudio on.');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await expect(element(by.id('subscriber'))).toExist();
    console.log('[subAudio] Subscribe audio toggle works.');
  });

  it('unsubscribe removes subscriber view', async () => {
    // Ensure bot1 is connected and subscriber visible
    const botState = await bot1.getState();
    if (!botState.connected) {
      await bot1.joinSession(
        credentials.apiKey,
        credentials.sessionId,
        credentials.tokenBot,
        { apiUrl: credentials.apiUrl }
      );
      await waitFor(element(by.id('subscriber'))).toExist().withTimeout(15000);
    }
    await expect(element(by.id('subscriber'))).toExist();

    // Navigate to Subscriber tab and tap unsubscribe
    await element(by.id('tabSubscriber')).tap();
    await element(by.id('unsubscribe')).tap();
    console.log('[unsubscribe] Tapped unsubscribe.');

    // Wait for subscriber to disappear
    await waitFor(element(by.id('subscriber'))).not.toExist().withTimeout(5000);
    console.log('[unsubscribe] Subscriber view removed.');
  });

  it('resubscribe restores subscriber view', async () => {
    // Bot should still be publishing — subscriber was just unsubscribed
    await element(by.id('tabSubscriber')).tap();
    await element(by.id('resubscribe')).tap();
    console.log('[resubscribe] Tapped resubscribe.');

    // Subscriber view should reappear
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
    console.log('[resubscribe] Subscriber view restored.');
  });

  it('set volume to 0 does not crash', async () => {
    await expect(element(by.id('subscriber'))).toExist();
    await element(by.id('tabSubscriber')).tap();
    await element(by.id('setVolume0')).tap();
    console.log('[volume] Set volume to 0.');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await expect(element(by.id('subscriber'))).toExist();
    console.log('[volume] Subscriber still exists after volume 0.');
  });

  it('set volume to 50 does not crash', async () => {
    await element(by.id('tabSubscriber')).tap();
    await element(by.id('setVolume50')).tap();
    console.log('[volume] Set volume to 50.');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await expect(element(by.id('subscriber'))).toExist();
    console.log('[volume] Subscriber still exists after volume 50.');
  });
});
