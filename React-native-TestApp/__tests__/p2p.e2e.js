'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');

const { TestSession } = require('./helpers/testSession');

/**
 * Publish/subscribe in relayed (peer-to-peer) sessions.
 */
describe('P2P (Relayed) Session', () => {
  let session;

  beforeAll(async () => {
    console.log('[setup] Launching app...');
    await launchAndWaitForApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    console.log('[setup] App ready.');

    session = await TestSession.createRelayed({ timeout: 45000 });
  });

  afterAll(async () => {
    if (session) await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    if (session) await session.cleanup();
  });

  it('app publishes in P2P — bot receives stream', async () => {
    await session.connectApp();
    console.log('[p2p-pub] Connected.');

    const bot = await session.addBot({ subscriberTimeout: 45000 });

    try {
      await bot.waitForStream({ timeout: 45000 });
    } catch (e) {
      const state = await bot.getState();
      throw new Error(`P2P: Bot did not receive app stream. State: ${JSON.stringify(state)}`);
    }

    const state = await bot.getState();
    console.log('[p2p-pub] Bot subscriberCount:', state.subscriberCount);
    if (state.subscriberCount < 1) {
      throw new Error(`Expected bot subscriberCount >= 1, got ${state.subscriberCount}`);
    }
    console.log('[p2p-pub] App publishes in P2P — bot receives. OK!');
  });
});
