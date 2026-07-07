'use strict';

const { jsSDKTesterBot } = require('./helpers/jsSDKTesterBot');
const { getCredentials } = require('./helpers/credentials');

/**
 * Basic connectivity tests verifying publish/subscribe between
 * the RN app and the jsSDKTesterBot (headless Chromium with JS SDK).
 */
describe('Publish and Subscribe', () => {
  let credentials;
  let bot;

  beforeAll(async () => {
    console.log('[setup] Getting credentials...');
    credentials = await getCredentials();
    console.log('[setup] sessionId:', credentials.sessionId);

    console.log('[setup] Launching app...');
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();

    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();
    console.log('[setup] App ready.');
  });

  afterAll(async () => {
    if (bot) {
      await bot.close();
    }
  });

  it('RN app publishes → bot receives stream', async () => {
    // App connects and publishes
    await expect(element(by.id('submitButton'))).toBeVisible();
    console.log('[publish→bot] Connecting app...');
    await element(by.id('submitButton')).tap();
    await new Promise((resolve) => setTimeout(resolve, 30000));
    await expect(element(by.id('disconnectSession'))).toBeVisible();
    await expect(element(by.id('publisher'))).toBeVisible();
    console.log('[publish→bot] App connected and publishing.');

    // Bot joins — should receive the app's stream
    console.log('[publish→bot] Launching bot...');
    bot = new jsSDKTesterBot({ timeout: 30000 });
    await bot.launch();
    console.log('[publish→bot] Bot joining session...');
    await bot.joinSession(
      credentials.apiKey,
      credentials.sessionId,
      credentials.tokenBot,
      { apiUrl: credentials.apiUrl }
    );
    console.log('[publish→bot] Bot connected and publishing.');

    // Wait for bot to receive the app's stream
    console.log('[publish→bot] Waiting for bot to receive app stream (30s)...');
    try {
      await bot.waitForSubscriber(30000);
    } catch (e) {
      const state = await bot.getState();
      console.log('[publish→bot] Bot state at timeout:', JSON.stringify(state));
      throw new Error(
        `Bot did not receive app stream within 30s. Bot state: ${JSON.stringify(state)}`
      );
    }
    const state = await bot.getState();
    console.log('[publish→bot] Bot subscriberCount:', state.subscriberCount);
    if (state.subscriberCount < 1) {
      throw new Error(`Expected bot to have at least 1 subscriber, got ${state.subscriberCount}`);
    }
  });

  it('Bot publishes → RN app shows subscriber', async () => {
    // Bot is already connected and publishing from previous test.
    // The app should have received the bot's stream.
    console.log('[bot→subscribe] Waiting for app subscriber (15s)...');
    await new Promise((resolve) => setTimeout(resolve, 15000));
    await expect(element(by.id('subscriber'))).toBeVisible();
    console.log('[bot→subscribe] Subscriber visible in app!');
  });
});
