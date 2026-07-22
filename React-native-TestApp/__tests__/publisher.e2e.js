'use strict';

const { jsSDKTesterBot } = require('./helpers/jsSDKTesterBot');
const { getCredentials } = require('./helpers/credentials');
const { setCaptureFilter, waitForEvent } = require('./helpers/eventCapture');
const { expect: jestExpect } = require('expect');

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

    // Connect app and launch bot here so each test starts from a known shared state
    console.log('[setup] Connecting app...');
    await element(by.id('submitButton')).tap();
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(30000);
    await expect(element(by.id('publisher'))).toExist();
    console.log('[setup] App connected and publishing.');

    // Verify session and publisher events fired
    await waitFor(element(by.id('session-sessionConnected'))).not.toHaveText('0').withTimeout(5000);
    await waitFor(element(by.id('publisher-streamCreated'))).not.toHaveText('0').withTimeout(5000);
    console.log('[setup] Session/publisher event indicators confirmed.');

    // Set up capture before bot joins so streamCreated is captured
    await setCaptureFilter(['streamCreated']);

    console.log('[setup] Launching bot...');
    bot = new jsSDKTesterBot({ timeout: 30000 });
    await bot.launch();
    console.log('[setup] Bot joining session...');
    await bot.joinSession(
      credentials.apiKey,
      credentials.sessionId,
      credentials.tokenBot,
      { apiUrl: credentials.apiUrl }
    );
    console.log('[setup] Bot connected and publishing.');
  });

  afterAll(async () => {
    await device.terminateApp();
    if (bot) {
      await bot.close();
    }
  });

  it('RN app publishes → bot receives stream', async () => {
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

    // Verify publisher stream created event indicator
    await waitFor(element(by.id('publisher-streamCreated'))).not.toHaveText('0').withTimeout(5000);
  });

  it('Bot publishes → RN app shows subscriber', async () => {
    console.log('[bot→subscribe] Waiting for app subscriber (15s)...');
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(15000);
    await expect(element(by.id('subscriber'))).toExist();
    console.log('[bot→subscribe] Subscriber visible in app!');

    // Verify session stream created event
    await waitFor(element(by.id('session-streamCreated'))).not.toHaveText('0').withTimeout(5000);

    // Verify streamCreated payload — bot publishes with name 'bot-publisher'
    // Filter was set in beforeAll before bot joined, so the event is already captured
    const streamEvent = await waitForEvent('streamCreated', 15000);
    console.log('[bot→subscribe] streamCreated payload:', JSON.stringify(streamEvent));
    jestExpect(streamEvent.streamId).toBeTruthy();
    jestExpect(streamEvent.name).toBe('bot-publisher');
  });
});
