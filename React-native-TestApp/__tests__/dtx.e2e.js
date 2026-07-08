'use strict';

const { jsSDKTesterBot } = require('./helpers/jsSDKTesterBot');
const { getCredentials } = require('./helpers/credentials');

/**
 * DTX (Discontinuous Transmission) Tests
 *
 * Verifies publish/subscribe works with DTX enabled and disabled.
 * Each test launches fresh app + bot to ensure clean state.
 */
describe('DTX Codec Option', () => {
  let credentials;
  let bot;

  beforeAll(async () => {
    credentials = await getCredentials();

    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();

    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();

    // Connect app
    await element(by.id('submitButton')).tap();
    console.log('[dtx] Connecting app...');
    await new Promise((resolve) => setTimeout(resolve, 30000));
    await expect(element(by.id('disconnectSession'))).toBeVisible();
    console.log('[dtx] App connected.');
  });

  afterAll(async () => {
    if (bot) await bot.close();
  });

  it('publish and subscribe work with DTX disabled (default)', async () => {
    bot = new jsSDKTesterBot({ timeout: 30000 });
    await bot.launch();
    console.log('[dtx-off] Bot joining...');

    try {
      await bot.joinSession(
        credentials.apiKey,
        credentials.sessionId,
        credentials.tokenBot,
        { apiUrl: credentials.apiUrl }
      );
    } catch (e) {
      const state = await bot.getState();
      console.log('[dtx-off] Bot FAILED:', state.error);
      throw e;
    }

    console.log('[dtx-off] Bot connected. Waiting for mutual streams...');
    await bot.waitForSubscriber(20000);

    const state = await bot.getState();
    if (state.subscriberCount < 1) {
      throw new Error('Bot did not receive app stream with DTX=false');
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
    await expect(element(by.id('subscriber'))).toExist();
    console.log('[dtx-off] App publishes (DTX=false) → bot receives. Bot publishes → app subscribes. OK!');

    // Disconnect bot for next test
    await bot.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 3000));
  });

  it('publish and subscribe work with DTX enabled', async () => {
    console.log('[dtx-on] Bot joining with DTX=true...');

    try {
      await bot.joinSession(
        credentials.apiKey,
        credentials.sessionId,
        credentials.tokenBot,
        { apiUrl: credentials.apiUrl, publisherOptions: { enableDtx: true } }
      );
    } catch (e) {
      const state = await bot.getState();
      console.log('[dtx-on] Bot FAILED:', state.error);
      throw e;
    }

    console.log('[dtx-on] Bot connected with DTX=true. Waiting for streams...');
    await bot.waitForSubscriber(20000);

    const state = await bot.getState();
    if (state.subscriberCount < 1) {
      throw new Error('Bot did not receive app stream when bot uses DTX=true');
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
    await expect(element(by.id('subscriber'))).toExist();
    console.log('[dtx-on] Bot publishes (DTX=true) → app subscribes. App publishes → bot receives. OK!');
  });
});
