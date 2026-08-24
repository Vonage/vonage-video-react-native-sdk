'use strict';

const { TestSession } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent, clearCapturedEvents } = require('./helpers/eventCapture');
const { expect: jestExpect } = require('expect');

describe('Subscriber Tests', () => {
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

  it('subscriber appears when bot publishes', async () => {
    // Connect app
    console.log('[subscriber] Connecting app...');
    await session.connectApp();

    // Set up event capture BEFORE bot joins
    await setCaptureFilter(['streamCreated', 'connectionCreated']);

    // Add bot — addBot() waits for subscriber internally
    console.log('[subscriber] Adding bot...');
    const bot = await session.addBot();
    console.log('[subscriber] Subscriber visible!');

    // Verify event indicators
    await waitFor(element(by.id('session-streamCreated'))).not.toHaveText('0').withTimeout(5000);
    await waitFor(element(by.id('session-connectionCreated'))).not.toHaveText('0').withTimeout(5000);

    // Verify streamCreated payload
    const streamEvent = await waitForEvent('streamCreated', 15000);
    console.log('[subscriber] streamCreated payload:', JSON.stringify(streamEvent));
    jestExpect(streamEvent.streamId).toBeTruthy();
    jestExpect(typeof streamEvent.streamId).toBe('string');

    // Verify connectionCreated payload
    const connEvent = await waitForEvent('connectionCreated', 15000);
    console.log('[subscriber] connectionCreated payload:', JSON.stringify(connEvent));
    jestExpect(connEvent.connectionId).toBeTruthy();
    jestExpect(typeof connEvent.connectionId).toBe('string');
  });

  it('subscriber disappears when bot disconnects', async () => {
    // Connect app
    console.log('[subscriber] Connecting app...');
    await session.connectApp();

    // Wait for any stale streams from the shared session to settle.
    // The previous test's bot may still be disconnecting on the server side,
    // which could briefly make a subscriber view appear and then disappear.
    // Ensure we start with NO subscriber view before adding our bot.
    try {
      await waitFor(element(by.id('subscriber'))).not.toExist().withTimeout(5000);
    } catch (_) {
      // If a stale subscriber is visible, wait for it to go away
      console.log('[subscriber] Stale subscriber detected, waiting for it to clear...');
      await waitFor(element(by.id('subscriber'))).not.toExist().withTimeout(15000);
    }

    // Set up event capture for streamDestroyed
    await setCaptureFilter(['streamDestroyed']);

    // Add a fresh bot for this test — addBot() waits for subscriber
    console.log('[subscriber] Adding bot...');
    const bot = await session.addBot();

    // Get bot's streamId before disconnect for later verification
    const botStreamId = await bot.page.evaluate(() => {
      if (window.botPublisher && window.botPublisher.stream) {
        return window.botPublisher.stream.streamId;
      }
      return null;
    });
    console.log('[subscriber] Bot streamId before disconnect:', botStreamId);

    // Bot disconnects — we explicitly disconnect rather than relying on cleanup
    // so we can verify the streamDestroyed event
    console.log('[subscriber] Bot disconnecting...');
    await bot.disconnect();

    // Verify streamDestroyed event with payload
    const destroyedEvent = await waitForEvent('streamDestroyed', 30000);
    console.log('[subscriber] streamDestroyed payload:', JSON.stringify(destroyedEvent));
    jestExpect(destroyedEvent.streamId).toBeTruthy();
    if (botStreamId) {
      jestExpect(destroyedEvent.streamId).toBe(botStreamId);
    }

    // Confirm the counter incremented
    await waitFor(element(by.id('session-streamDestroyed'))).not.toHaveText('0').withTimeout(5000);
    console.log('[subscriber] Stream destroyed event verified with correct streamId.');

    // Give the UI time to unmount the subscriber view
    await waitFor(element(by.id('subscriber'))).not.toExist().withTimeout(15000);
    console.log('[subscriber] Subscriber gone after bot disconnect.');
  });
});
