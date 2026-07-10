'use strict';

const { jsSDKTesterBot } = require('./helpers/jsSDKTesterBot');
const { getCredentials } = require('./helpers/credentials');

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
    await new Promise((resolve) => setTimeout(resolve, 30000));
    await expect(element(by.id('disconnectSession'))).toBeVisible();
    console.log('[session] Connected. Disconnecting...');

    await element(by.id('disconnectSession')).tap();
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await expect(element(by.id('submitButton'))).toBeVisible();
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
    await new Promise((resolve) => setTimeout(resolve, 30000));
    await expect(element(by.id('disconnectSession'))).toBeVisible();
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
    await new Promise((resolve) => setTimeout(resolve, 30000));
    await expect(element(by.id('publisher'))).toExist();
    console.log('[session] Publishing. Disconnecting...');

    await element(by.id('disconnectSession')).tap();
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await expect(element(by.id('submitButton'))).toBeVisible();
    console.log('[session] Disconnected while publishing — no crash.');
  });

  it('disconnect while subscribing does not crash', async () => {
    // Reconnect
    await element(by.id('submitButton')).tap();
    console.log('[session] Connecting for subscribe test...');
    await new Promise((resolve) => setTimeout(resolve, 30000));
    await expect(element(by.id('disconnectSession'))).toBeVisible();

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
    await new Promise((resolve) => setTimeout(resolve, 15000));
    await expect(element(by.id('subscriber'))).toExist();
    console.log('[session] Subscribing. Disconnecting...');

    await element(by.id('disconnectSession')).tap();
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await expect(element(by.id('submitButton'))).toBeVisible();
    console.log('[session] Disconnected while subscribing — no crash.');
  });

  it('app receives signal from bot', async () => {
    // Reconnect
    await element(by.id('submitButton')).tap();
    console.log('[signal] Connecting...');
    await new Promise((resolve) => setTimeout(resolve, 30000));
    await expect(element(by.id('disconnectSession'))).toBeVisible();

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
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify app received signal (indicator in view tree)
    await expect(element(by.id('signalReceivedIndicator'))).toExist();
    console.log('[signal] App received signal from bot!');
  });
});
