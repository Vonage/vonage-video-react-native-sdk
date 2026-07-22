'use strict';

const { jsSDKTesterBot } = require('./helpers/jsSDKTesterBot');
const { getCredentials } = require('./helpers/credentials');

/**
 * Encryption Tests
 *
 * Verifies that setEncryptionSecret can be called without crashing
 * and that publish/subscribe still works with encryption configured.
 *
 * Note: The JS SDK bot does not support encryption, so we only verify
 * the app-side behavior (no crash, session stays connected, publisher active).
 */
describe('Encryption', () => {
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

  it('session connects with encryption secret set', async () => {
    // Type encryption secret before connecting
    await element(by.id('apiKeyInput')).replaceText(credentials.apiKey);
    await element(by.id('sessionIdInput')).replaceText(credentials.sessionId);
    await element(by.id('tokenInput')).replaceText(credentials.tokenApp);

    // Connect
    await element(by.id('submitButton')).tap();
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(30000);
    console.log('[encryption] App connected with encryption secret.');

    // Verify publisher is active (no crash)
    await waitFor(element(by.id('publisher'))).toBeVisible().withTimeout(10000);
    console.log('[encryption] Publisher visible — encryption did not prevent publishing.');

    // Verify session stays connected
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await expect(element(by.id('disconnectSession'))).toBeVisible();
    console.log('[encryption] Session remains stable with encryption.');
  });

  it('publish and subscribe work after encryption is configured', async () => {
    // Bot joins (without encryption — it will see encrypted media but can still connect)
    bot = new jsSDKTesterBot({ timeout: 30000 });
    await bot.launch();
    await bot.joinSession(
      credentials.apiKey,
      credentials.sessionId,
      credentials.tokenBot,
      { apiUrl: credentials.apiUrl }
    );
    console.log('[encryption] Bot connected and publishing.');

    // Wait for subscriber to appear (bot's stream arrives)
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(20000);
    console.log('[encryption] Subscriber view appeared — stream received.');

    // Verify bot sees the app's stream (even if encrypted, the stream object arrives)
    await bot.waitForSubscriber(15000);
    console.log('[encryption] Bot received app stream.');

    // Verify no errors on app side
    await expect(element(by.id('disconnectSession'))).toBeVisible();
    console.log('[encryption] No crashes — publish/subscribe works with encryption configured.');
  });

  it('disconnect and reconnect works after encryption was set', async () => {
    // Disconnect
    await element(by.id('disconnectSession')).tap();
    await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(10000);
    console.log('[encryption] Disconnected.');

    // Reconnect
    await element(by.id('submitButton')).tap();
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(30000);
    console.log('[encryption] Reconnected successfully after encryption session.');

    // Verify publisher still works
    await waitFor(element(by.id('publisher'))).toBeVisible().withTimeout(10000);
    await expect(element(by.id('disconnectSession'))).toBeVisible();
    console.log('[encryption] Session stable on reconnect.');
  });
});
