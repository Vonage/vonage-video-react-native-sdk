'use strict';

const { jsSDKTesterBot } = require('./helpers/jsSDKTesterBot');
const { getCredentials } = require('./helpers/credentials');
const { setCaptureFilter, waitForEvent, clearCapturedEvents } = require('./helpers/eventCapture');
const { expect: jestExpect } = require('expect');

/**
 * Session Lifecycle Tests
 *
 * Tests session operations: connect/disconnect cycles,
 * disconnect while publishing/subscribing.
 *
 * Each test that needs a fresh state launches a new app instance.
 */
describe('Session Lifecycle', () => {
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
  });

  afterAll(async () => {
    await device.terminateApp();
    if (bot) await bot.close();
  });

  it('connect and disconnect cleanly', async () => {
    await element(by.id('submitButton')).tap();
    console.log('[session] Connecting...');
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(30000);
    console.log('[session] Connected.');

    // Verify session connected event indicator
    await waitFor(element(by.id('session-sessionConnected'))).not.toHaveText('0').withTimeout(5000);

    console.log('[session] Disconnecting...');
    await element(by.id('disconnectSession')).tap();
    await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
    console.log('[session] Disconnected cleanly.');
  });

  it('reconnect after disconnect', async () => {
    // Ensure we start disconnected (guard against previous test failing mid-connect)
    try {
      await element(by.id('disconnectSession')).tap();
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (_) {
      // Already disconnected — expected path
    }
    await element(by.id('submitButton')).tap();
    console.log('[session] Reconnecting...');
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(30000);
    console.log('[session] Reconnected successfully.');
  });

  it('disconnect while publishing does not crash', async () => {
    // Establish connected state explicitly instead of relying on previous test outcome
    try {
      await element(by.id('disconnectSession')).tap();
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (_) {
      // Already disconnected
    }
    await element(by.id('submitButton')).tap();
    console.log('[session] Connecting...');
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(30000);
    console.log('[session] Publishing. Disconnecting...');

    await element(by.id('disconnectSession')).tap();
    await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
    console.log('[session] Disconnected while publishing — no crash.');
  });

  it('disconnect while subscribing does not crash', async () => {
    // Reconnect
    await element(by.id('submitButton')).tap();
    console.log('[session] Connecting for subscribe test...');
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(30000);

    // Set up capture for streamCreated payload verification
    await setCaptureFilter(['streamCreated']);

    // Bot joins
    bot = new jsSDKTesterBot({ timeout: 30000 });
    await bot.launch();
    await bot.joinSession(
      credentials.apiKey,
      credentials.sessionId,
      credentials.tokenBot,
      { apiUrl: credentials.apiUrl }
    );
    console.log('[session] Bot publishing. Waiting for subscriber...');
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(15000);
    console.log('[session] Subscribing.');

    // Verify session stream created event counter
    await waitFor(element(by.id('session-streamCreated'))).not.toHaveText('0').withTimeout(5000);

    // Verify streamCreated payload contains valid stream info
    const streamEvent = await waitForEvent('streamCreated', 15000);
    console.log('[session] streamCreated payload:', JSON.stringify(streamEvent));
    jestExpect(streamEvent.streamId).toBeTruthy();
    jestExpect(typeof streamEvent.streamId).toBe('string');

    console.log('[session] Disconnecting...');
    await element(by.id('disconnectSession')).tap();
    await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
    console.log('[session] Disconnected while subscribing — no crash.');
  });

  it('app receives signal from bot', async () => {
    // Reconnect
    await element(by.id('submitButton')).tap();
    console.log('[signal] Connecting...');
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(30000);

    // Set up capture for signal payload verification
    await setCaptureFilter(['signal']);

    // Ensure bot is connected
    if (!bot) {
      bot = new jsSDKTesterBot({ timeout: 30000 });
      await bot.launch();
    }
    await bot.joinSession(
      credentials.apiKey,
      credentials.sessionId,
      credentials.tokenBot,
      { apiUrl: credentials.apiUrl }
    );
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Bot sends signal
    console.log('[signal] Bot sending signal...');
    await bot.sendSignal('chat', 'hello-from-bot');

    // Verify app received signal with correct payload
    const signal = await waitForEvent('signal', 10000);
    console.log('[signal] Signal payload:', JSON.stringify(signal));

    jestExpect(signal.data).toBe('hello-from-bot');
    jestExpect(signal.type).toContain('chat');
    console.log('[signal] Signal data and type verified!');

    // Also confirm the counter incremented
    await waitFor(element(by.id('session-signalReceived'))).not.toHaveText('0').withTimeout(5000);
    console.log('[signal] App received signal from bot with verified payload!');
  });
});
