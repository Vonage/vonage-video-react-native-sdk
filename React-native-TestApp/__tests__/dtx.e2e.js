'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');

const { TestSession } = require('./helpers/testSession');

/**
 * Publish/subscribe with DTX (Discontinuous Transmission) enabled and disabled.
 */
describe('DTX Codec Option', () => {
  let session;

  beforeAll(async () => {
    await launchAndWaitForApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });

    session = await TestSession.create({ timeout: 30000 });
  });

  afterAll(async () => {
    if (session) await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    if (session) await session.cleanup();
  });

  it('publish and subscribe work with DTX disabled (default)', async () => {
    await session.connectApp();
    console.log('[dtx-off] App connected.');

    const bot = await session.addBot({ subscriberTimeout: 30000 });
    console.log('[dtx-off] Subscriber visible.');

    try {
      await bot.waitForStream({ timeout: 30000 });
    } catch (e) {
      const state = await bot.getState();
      throw new Error(`Bot did not receive app stream with DTX=false. State: ${JSON.stringify(state)}`);
    }

    console.log('[dtx-off] Mutual streams confirmed (DTX=false). OK!');
  });

  it('publish and subscribe work with DTX enabled', async () => {
    await session.connectApp();
    console.log('[dtx-on] App connected.');

    const bot = await session.addBot({
      subscriberTimeout: 30000,
      publisherOptions: { enableDtx: true },
    });
    console.log('[dtx-on] Subscriber visible (DTX=true).');

    try {
      await bot.waitForStream({ timeout: 30000 });
    } catch (e) {
      const state = await bot.getState();
      throw new Error(`Bot did not receive app stream with DTX=true. State: ${JSON.stringify(state)}`);
    }

    console.log('[dtx-on] Mutual streams confirmed (DTX=true). OK!');
  });
});
