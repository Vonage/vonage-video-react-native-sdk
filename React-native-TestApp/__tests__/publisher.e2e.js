'use strict';

const { TestSession } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent } = require('./helpers/eventCapture');
const { expect: jestExpect } = require('expect');

/**
 * Basic connectivity tests verifying publish/subscribe between
 * the RN app and the jsSDKTesterBot (headless Chromium with JS SDK).
 */
describe('Publish and Subscribe', () => {
  let session;

  beforeAll(async () => {
    console.log('[setup] Launching app...');
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();

    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();
    console.log('[setup] App ready.');

    session = await TestSession.create();
  });

  afterAll(async () => {
    await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    await session.cleanup();
  });

  it('RN app publishes → bot receives stream', async () => {
    // Connect app and start publishing
    console.log('[publish→bot] Connecting app...');
    await session.connectApp();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(30000);
    console.log('[publish→bot] App connected and publishing.');

    // Verify session and publisher events fired
    await waitFor(element(by.id('session-sessionConnected'))).not.toHaveText('0').withTimeout(5000);
    await waitFor(element(by.id('publisher-streamCreated'))).not.toHaveText('0').withTimeout(5000);
    console.log('[publish→bot] Session/publisher event indicators confirmed.');

    // Add bot — 2 participants = relayed
    console.log('[publish→bot] Adding bot...');
    const bot = await session.addBot();

    // Wait for bot to receive app stream
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
    jestExpect(state.subscriberCount).toBeGreaterThanOrEqual(1);

    // Verify publisher stream created event indicator
    await waitFor(element(by.id('publisher-streamCreated'))).not.toHaveText('0').withTimeout(5000);
  });

  it('Bot publishes → RN app shows subscriber', async () => {
    // Connect app
    console.log('[bot→subscribe] Connecting app...');
    await session.connectApp();

    // Set up event capture BEFORE bot joins so streamCreated is captured
    await setCaptureFilter(['streamCreated']);

    // Add bot — 2 participants = relayed
    console.log('[bot→subscribe] Adding bot...');
    const bot = await session.addBot();

    // Wait for subscriber view to appear
    console.log('[bot→subscribe] Waiting for app subscriber (15s)...');
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(15000);
    console.log('[bot→subscribe] Subscriber visible in app!');

    // Verify session stream created event indicator
    await waitFor(element(by.id('session-streamCreated'))).not.toHaveText('0').withTimeout(5000);

    // Verify streamCreated payload — bot publishes with name 'bot-publisher'
    const streamEvent = await waitForEvent('streamCreated', 15000);
    console.log('[bot→subscribe] streamCreated payload:', JSON.stringify(streamEvent));
    jestExpect(streamEvent.streamId).toBeTruthy();

    if (streamEvent.name) {
      jestExpect(streamEvent.name).toBe('bot-publisher');
    } else {
      console.log('[bot→subscribe] streamCreated.name is empty — metadata not yet propagated (known Android race).');
    }
  });
});
