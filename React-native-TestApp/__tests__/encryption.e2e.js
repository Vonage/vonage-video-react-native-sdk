'use strict';

const { TestSession } = require('./helpers/testSession');

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
  let session;

  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();

    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();

    session = await TestSession.create();
  });

  afterAll(async () => {
    await session.teardown();
    await device.terminateApp();
  });

  it('session connects with encryption secret set', async () => {
    // Connect app
    await session.connectApp();
    console.log('[encryption] App connected with encryption secret.');

    // Verify publisher is active (no crash)
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(10000);
    console.log('[encryption] Publisher visible — encryption did not prevent publishing.');

    // Verify session stays connected
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(15000);
    console.log('[encryption] Session remains stable with encryption.');
  });

  it('publish and subscribe work after encryption is configured', async () => {
    // Bot joins — addBot waits for subscriber
    const bot = await session.addBot();
    console.log('[encryption] Bot connected and publishing.');

    // Verify subscriber appeared
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(15000);
    console.log('[encryption] Subscriber view appeared — stream received.');

    // Verify bot sees the app's stream
    await bot.waitForSubscriber(15000);
    console.log('[encryption] Bot received app stream.');

    // Verify no errors on app side
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(15000);
    console.log('[encryption] No crashes — publish/subscribe works with encryption configured.');
  });

  it('disconnect and reconnect works after encryption was set', async () => {
    // Disconnect
    await session.disconnectApp();
    console.log('[encryption] Disconnected.');

    // Reconnect
    await session.connectApp();
    console.log('[encryption] Reconnected successfully after encryption session.');

    // Verify publisher still works
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(10000);
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(15000);
    console.log('[encryption] Session stable on reconnect.');
  });
});
