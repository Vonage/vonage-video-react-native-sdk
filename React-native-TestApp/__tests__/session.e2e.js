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
    await new Promise((resolve) => setTimeout(resolve, 5000));
  });

  afterAll(async () => {
    if (bot) await bot.close();
  });

  it('connect and disconnect cleanly', async () => {
    await expect(element(by.id('submitButton'))).toBeVisible();
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
    // Should see submitButton from previous test
    await expect(element(by.id('submitButton'))).toBeVisible();
    await element(by.id('submitButton')).tap();
    console.log('[session] Reconnecting...');
    await new Promise((resolve) => setTimeout(resolve, 30000));
    await expect(element(by.id('disconnectSession'))).toBeVisible();
    console.log('[session] Reconnected successfully.');
  });

  it('disconnect while publishing does not crash', async () => {
    // Still connected from previous test
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
});
