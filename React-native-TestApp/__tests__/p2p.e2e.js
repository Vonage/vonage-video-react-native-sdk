'use strict';

const { TestSession } = require('./helpers/testSession');

/**
 * P2P (Relayed) Session Tests
 *
 * Verifies publish/subscribe behavior in relayed (peer-to-peer) sessions.
 * Relayed sessions route media directly between participants (no server relay).
 *
 */
describe('P2P (Relayed) Session', () => {
  let session;
  const publisherControlTimeout = 10000;

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

    session = await TestSession.createRelayed({ timeout: 45000 });
  });

  afterAll(async () => {
    await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    await session.cleanup();
  });

  it('app publishes in P2P — bot receives stream', async () => {
    await session.connectApp();
    console.log('[p2p-pub] Connected.');

    // addBot waits for subscriber; then verify bot received app stream
    const bot = await session.addBot({ subscriberTimeout: 45000 });

    try {
      await bot.waitForSubscriber(45000);
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

  it('bot publishes in P2P — app shows subscriber', async () => {
    await session.connectApp();
    console.log('[p2p-sub] Connected.');

    // addBot waits for subscriber view
    await session.addBot({ subscriberTimeout: 30000 });

    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
    console.log('[p2p-sub] Subscriber visible in P2P session!');
  });

  it('unpublish and republish in P2P session', async () => {
    await session.connectApp();
    console.log('[p2p-unpub] Connected.');

    await session.addBot({ subscriberTimeout: 30000 });

    // Unpublish
    await element(by.id('tabSession')).tap();
    await element(by.id('stopPublishing')).tap();
    console.log('[p2p-unpub] Unpublished.');

    // Republish
    await element(by.id('stopPublishing')).tap();
    console.log('[p2p-unpub] Republished.');
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);
    console.log('[p2p-unpub] Publisher restored in P2P.');
  });

  it('audio-only publishing in P2P', async () => {
    await session.connectApp();
    console.log('[p2p-audio] Connected.');

    await session.addBot({ subscriberTimeout: 30000 });

    // Disable video (audio-only)
    await waitFor(element(by.id('tabPublisher')))
      .toBeVisible()
      .withTimeout(publisherControlTimeout);
    await element(by.id('tabPublisher')).tap();
    await waitFor(element(by.id('hasVideo')))
      .toBeVisible()
      .withTimeout(publisherControlTimeout);
    await element(by.id('hasVideo')).tap();
    console.log('[p2p-audio] Video off.');

    // Verify publisher still exists
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);

    // Restore video
    await waitFor(element(by.id('hasVideo')))
      .toBeVisible()
      .withTimeout(publisherControlTimeout);
    await element(by.id('hasVideo')).tap();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);
    console.log('[p2p-audio] Audio-only publish OK in P2P.');
  });

  it('video-only publishing in P2P', async () => {
    await session.connectApp();
    console.log('[p2p-video] Connected.');

    await session.addBot({ subscriberTimeout: 30000 });

    // Disable audio (video-only)
    await waitFor(element(by.id('tabPublisher')))
      .toBeVisible()
      .withTimeout(publisherControlTimeout);
    await element(by.id('tabPublisher')).tap();
    await waitFor(element(by.id('hasAudio')))
      .toBeVisible()
      .withTimeout(publisherControlTimeout);
    await element(by.id('hasAudio')).tap();
    console.log('[p2p-video] Audio off.');

    // Verify publisher still exists
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);

    // Restore audio
    await waitFor(element(by.id('hasAudio')))
      .toBeVisible()
      .withTimeout(publisherControlTimeout);
    await element(by.id('hasAudio')).tap();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);
    console.log('[p2p-video] Video-only publish OK in P2P.');
  });
});
