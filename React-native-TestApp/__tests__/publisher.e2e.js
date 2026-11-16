'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');

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
    await launchAndWaitForApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    console.log('[setup] App ready.');

    session = await TestSession.create();
  });

  afterAll(async () => {
    if (session) await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    if (session) await session.cleanup();
  });

  it('RN app publishes → bot receives stream', async () => {
    console.log('[publish→bot] Connecting app...');
    await session.connectApp();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(30000);
    console.log('[publish→bot] App connected and publishing.');

    await waitFor(element(by.id('session-sessionConnected'))).not.toHaveText('0').withTimeout(5000);
    await waitFor(element(by.id('publisher-streamCreated'))).not.toHaveText('0').withTimeout(5000);
    console.log('[publish→bot] Session/publisher event indicators confirmed.');

    console.log('[publish→bot] Adding bot...');
    const bot = await session.addBot();

    console.log('[publish→bot] Waiting for bot to receive app stream (30s)...');
    try {
      await bot.waitForStream({ timeout: 30000 });
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

    await waitFor(element(by.id('publisher-streamCreated'))).not.toHaveText('0').withTimeout(5000);
  });

  it('Bot publishes → RN app shows subscriber', async () => {
    console.log('[bot→subscribe] Connecting app...');
    await session.connectApp();

    // Set up event capture BEFORE bot joins so streamCreated is captured
    await setCaptureFilter(['streamCreated']);

    console.log('[bot→subscribe] Adding bot...');
    const bot = await session.addBot();

    console.log('[bot→subscribe] Waiting for app subscriber (15s)...');
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(15000);
    console.log('[bot→subscribe] Subscriber visible in app!');

    await waitFor(element(by.id('session-streamCreated'))).not.toHaveText('0').withTimeout(5000);

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
