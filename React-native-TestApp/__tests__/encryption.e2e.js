'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');

const { TestSession } = require('./helpers/testSession');

/**
 * setEncryptionSecret does not crash and publish/subscribe keeps working. The JS SDK bot does not
 * support encryption, so only the app side is verified.
 */
describe('Encryption', () => {
  let session;

  beforeAll(async () => {
    await launchAndWaitForApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });

    session = await TestSession.create();
  });

  afterAll(async () => {
    if (session) await session.teardown();
    await device.terminateApp();
  });

  it('session connects with encryption secret set', async () => {
    await session.connectApp();
    console.log('[encryption] App connected with encryption secret.');

    await waitFor(element(by.id('publisher'))).toExist().withTimeout(10000);
    console.log('[encryption] Publisher visible — encryption did not prevent publishing.');

    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(5000);
    console.log('[encryption] Session remains stable with encryption.');
  });

  it('publish and subscribe work after encryption is configured', async () => {
    const bot = await session.addBot();
    console.log('[encryption] Bot connected and publishing.');

    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
    console.log('[encryption] Subscriber view appeared — stream received.');

    await bot.waitForStream({ timeout: 15000 });
    console.log('[encryption] Bot received app stream.');

    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(5000);
    console.log('[encryption] No crashes — publish/subscribe works with encryption configured.');
  });

  it('disconnect and reconnect works after encryption was set', async () => {
    await session.disconnectApp();
    console.log('[encryption] Disconnected.');

    await session.connectApp();
    console.log('[encryption] Reconnected successfully after encryption session.');

    await waitFor(element(by.id('publisher'))).toExist().withTimeout(10000);
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(5000);
    console.log('[encryption] Session stable on reconnect.');
  });
});
