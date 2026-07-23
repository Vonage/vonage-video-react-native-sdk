'use strict';

const { TestSession } = require('./helpers/testSession');

/**
 * DTX (Discontinuous Transmission) Tests
 *
 * Verifies publish/subscribe works with DTX enabled and disabled.
 * Uses TestSession for credential management and bot lifecycle.
 */
describe('DTX Codec Option', () => {
  let session;

  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();

    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();

    session = await TestSession.create({ timeout: 30000 });
  });

  afterAll(async () => {
    await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    await session.cleanup();
  });

  it('publish and subscribe work with DTX disabled (default)', async () => {
    await session.connectApp();
    console.log('[dtx-off] App connected.');

    // Add bot — addBot waits for subscriber view (app receives bot stream)
    const bot = await session.addBot({ subscriberTimeout: 30000 });
    console.log('[dtx-off] Subscriber visible.');

    // Verify bot also received app stream
    try {
      await bot.waitForSubscriber(30000);
    } catch (e) {
      const state = await bot.getState();
      throw new Error(`Bot did not receive app stream with DTX=false. State: ${JSON.stringify(state)}`);
    }

    console.log('[dtx-off] Mutual streams confirmed (DTX=false). OK!');
  });

  it('publish and subscribe work with DTX enabled', async () => {
    await session.connectApp();
    console.log('[dtx-on] App connected.');

    // Create bot manually to pass DTX publisher option
    const bot = await session.createBot();
    await bot.joinSession(
      session.credentials.apiKey,
      session.credentials.sessionId,
      session.credentials.tokenBot,
      {
        apiUrl: session.credentials.apiUrl,
        jsSdkUrl: session.credentials.jsSdkUrl,
        publisherOptions: { enableDtx: true },
      }
    );
    console.log('[dtx-on] Bot connected with DTX=true.');

    // Wait for subscriber view (app receives bot stream)
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(30000);
    console.log('[dtx-on] Subscriber visible.');

    // Verify bot also received app stream
    try {
      await bot.waitForSubscriber(30000);
    } catch (e) {
      const state = await bot.getState();
      throw new Error(`Bot did not receive app stream with DTX=true. State: ${JSON.stringify(state)}`);
    }

    console.log('[dtx-on] Mutual streams confirmed (DTX=true). OK!');
  });
});
