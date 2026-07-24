'use strict';

const { TestSession, poll } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent, clearCapturedEvents, getLastEvent } = require('./helpers/eventCapture');
const { expect: jestExpect } = require('expect');

/**
 * Session Lifecycle Tests
 *
 * Tests session operations: connect/disconnect cycles,
 * disconnect while publishing/subscribing, and signal reception.
 */
describe('Session Lifecycle', () => {
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

  it('connect and disconnect cleanly', async () => {
    // Connect app (defensive disconnect built-in)
    console.log('[session] Connecting...');
    await session.connectApp();
    console.log('[session] Connected.');

    // Verify session connected event indicator
    await poll(() => expect(element(by.id('session-sessionConnected'))).not.toHaveText('0'), 5000);

    // Disconnect
    console.log('[session] Disconnecting...');
    await session.disconnectApp();
    await poll(() => expect(element(by.id('submitButton'))).toBeVisible(), 5000);
    console.log('[session] Disconnected cleanly.');
  });

  it('reconnect after disconnect', async () => {
    // Connect
    console.log('[session] Connecting...');
    await session.connectApp();
    console.log('[session] Connected.');

    // Disconnect
    console.log('[session] Disconnecting...');
    await session.disconnectApp();
    await poll(() => expect(element(by.id('submitButton'))).toBeVisible(), 5000);
    console.log('[session] Disconnected.');

    // Reconnect
    console.log('[session] Reconnecting...');
    await session.connectApp();
    await poll(() => expect(element(by.id('disconnectSession'))).toBeVisible(), 30000);
    console.log('[session] Reconnected successfully.');
  });

  it('disconnect while publishing does not crash', async () => {
    // Connect app
    console.log('[session] Connecting...');
    await session.connectApp();

    // Wait for publisher to appear (confirms we are actively publishing)
    await poll(() => expect(element(by.id('publisher'))).toExist(), 30000);
    console.log('[session] Publishing. Disconnecting...');

    // Disconnect while publishing
    await session.disconnectApp();
    await poll(() => expect(element(by.id('submitButton'))).toBeVisible(), 5000);
    console.log('[session] Disconnected while publishing — no crash.');
  });

  it('disconnect while subscribing does not crash', async () => {
    // Connect app
    console.log('[session] Connecting for subscribe test...');
    await session.connectApp();

    // Set up capture for streamCreated payload verification
    await setCaptureFilter(['streamCreated']);

    // Add bot — addBot() waits for subscriber view
    console.log('[session] Adding bot...');
    const bot = await session.addBot();
    console.log('[session] Subscribing.');

    // Verify streamCreated payload contains valid stream info
    const streamEvent = await waitForEvent('streamCreated');
    console.log('[session] streamCreated payload:', JSON.stringify(streamEvent));
    jestExpect(streamEvent.streamId).toBeTruthy();

    // Disconnect while subscribing
    console.log('[session] Disconnecting...');
    await session.disconnectApp();
    await poll(() => expect(element(by.id('submitButton'))).toBeVisible(), 5000);
    console.log('[session] Disconnected while subscribing — no crash.');
  });

  it('app receives signal from bot', async () => {
    // Connect app
    console.log('[signal] Connecting...');
    await session.connectApp();

    // Set up capture for signal payload verification
    await setCaptureFilter(['signal']);

    // Add bot (joinSession waits for connected && publishing)
    console.log('[signal] Adding bot...');
    const bot = await session.addBot();

    // Poll: send the signal repeatedly and check if the app captured it.
    // The capture system only stores the LAST event of each type, so if a
    // stray signal overwrites ours we need to re-send and re-check.
    let signal = null;
    const start = Date.now();
    const timeout = 30000;
    let sendCount = 0;

    while (Date.now() - start < timeout) {
      // Send signal every 3 seconds
      if (sendCount === 0 || (Date.now() - start) > sendCount * 3000) {
        sendCount++;
        console.log(`[signal] Sending signal attempt #${sendCount}...`);
        await bot.sendSignal('e2e-test-signal', 'hello-from-bot');
      }

      // Check if our signal was captured
      const payload = await getLastEvent('signal');
      if (payload && payload.type && payload.type.includes('e2e-test-signal')) {
        signal = payload;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!signal) {
      throw new Error(`Did not receive e2e-test-signal within ${timeout / 1000}s (sent ${sendCount} times)`);
    }

    console.log('[signal] Signal payload:', JSON.stringify(signal));
    jestExpect(signal.data).toBe('hello-from-bot');
    jestExpect(signal.type).toContain('e2e-test-signal');
    console.log('[signal] Signal data and type verified!');

    // Confirm the counter incremented
    await poll(() => expect(element(by.id('session-signalReceived'))).not.toHaveText('0'), 5000);
    console.log('[signal] App received signal from bot with verified payload!');
  });
});
