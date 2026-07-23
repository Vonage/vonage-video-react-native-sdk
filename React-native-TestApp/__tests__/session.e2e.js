'use strict';

const { TestSession } = require('./helpers/testSession');
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
    await waitFor(element(by.id('session-sessionConnected'))).not.toHaveText('0').withTimeout(5000);

    // Disconnect
    console.log('[session] Disconnecting...');
    await session.disconnectApp();
    await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
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
    await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
    console.log('[session] Disconnected.');

    // Reconnect
    console.log('[session] Reconnecting...');
    await session.connectApp();
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(30000);
    console.log('[session] Reconnected successfully.');
  });

  it('disconnect while publishing does not crash', async () => {
    // Connect app
    console.log('[session] Connecting...');
    await session.connectApp();

    // Wait for publisher to appear (confirms we are actively publishing)
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(30000);
    console.log('[session] Publishing. Disconnecting...');

    // Disconnect while publishing
    await session.disconnectApp();
    await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
    console.log('[session] Disconnected while publishing — no crash.');
  });

  it('disconnect while subscribing does not crash', async () => {
    // Connect app
    console.log('[session] Connecting for subscribe test...');
    await session.connectApp();

    // Clear any residual events and set up capture
    await clearCapturedEvents();
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
    await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
    console.log('[session] Disconnected while subscribing — no crash.');
  });

  it('app receives signal from bot', async () => {
    // Connect app
    console.log('[signal] Connecting...');
    await session.connectApp();

    // Clear any residual events and set up capture
    await clearCapturedEvents();
    await setCaptureFilter(['signal']);

    // Add bot (joinSession waits for connected && publishing)
    console.log('[signal] Adding bot...');
    const bot = await session.addBot();

    // Bot sends signal with unique type to avoid stray signals
    console.log('[signal] Bot sending signal...');
    await bot.sendSignal('e2e-test-signal', 'hello-from-bot');

    // Poll for the specific signal (ignore stray signals)
    let signal = null;
    const start = Date.now();
    while (Date.now() - start < 15000) {
      const payload = await getLastEvent('signal');
      if (payload && payload.type && payload.type.includes('e2e-test-signal')) {
        signal = payload;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!signal) {
      throw new Error('Did not receive e2e-test-signal within 15s');
    }

    console.log('[signal] Signal payload:', JSON.stringify(signal));
    jestExpect(signal.data).toBe('hello-from-bot');
    jestExpect(signal.type).toContain('e2e-test-signal');
    console.log('[signal] Signal data and type verified!');

    // Confirm the counter incremented
    await waitFor(element(by.id('session-signalReceived'))).not.toHaveText('0').withTimeout(5000);
    console.log('[signal] App received signal from bot with verified payload!');
  });
});
