'use strict';

const { jsSDKTesterBot } = require('./helpers/jsSDKTesterBot');
const { getRelayedCredentials } = require('./helpers/credentials');

/**
 * P2P (Relayed) Session Tests
 *
 * Verifies publish/subscribe behavior in relayed (peer-to-peer) sessions.
 * Relayed sessions route media directly between participants (no server relay).
 *
 * Uses separate relayed session credentials from sdk-config.json.
 */
describe('P2P (Relayed) Session', () => {
  let credentials;
  let bot;

  beforeAll(async () => {
    credentials = await getRelayedCredentials();

    if (!credentials.tokenBot) {
      console.warn('No tokenBot for relayed session — P2P tests will be limited.');
    }

    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();

    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();

    // Connect app with relayed session credentials
    // Need to input relayed credentials — tap the apiKey field and clear/type
    // Actually, credentials are pre-loaded from sdk-config.json via the app's config.
    // The app uses credentials.apiKey/sessionId/token from config.
    // For relayed tests, we need to override. Use the text inputs.

    // Expand connection settings if collapsed (tap the title)
    try {
      await element(by.id('apiKeyInput')).tap();
    } catch (e) {
      // Connection settings might be collapsed or showing manual mode already
      // Try tapping the card title to expand
      await element(by.text('▼ Connection Settings')).tap().catch(() => {});
      await element(by.text('▶ Connection Settings')).tap().catch(() => {});
    }

    // Clear and set relayed credentials
    await element(by.id('apiKeyInput')).clearText();
    await element(by.id('apiKeyInput')).typeText(credentials.apiKey);
    await element(by.id('sessionIdInput')).clearText();
    await element(by.id('sessionIdInput')).typeText(credentials.sessionId);
    await element(by.id('tokenInput')).clearText();
    await element(by.id('tokenInput')).typeText(credentials.tokenApp);

    // Connect
    await element(by.id('submitButton')).tap();
    console.log('[p2p] Connecting to relayed session...');
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(30000);
    console.log('[p2p] Connected to relayed session.');

    // Launch bot
    bot = new jsSDKTesterBot({ timeout: 45000 });
    await bot.launch();
  });

  afterAll(async () => {
    await device.terminateApp();
    if (bot) await bot.close();
  });

  it('app publishes in P2P — bot receives stream', async () => {
    console.log('[p2p-pub] Bot joining relayed session...');
    await bot.joinSession(
      credentials.apiKey,
      credentials.sessionId,
      credentials.tokenBot,
      { apiUrl: credentials.apiUrl }
    );

    console.log('[p2p-pub] Waiting for bot to receive app stream (45s)...');
    try {
      await bot.waitForSubscriber(45000);
    } catch (e) {
      const state = await bot.getState();
      console.log('[p2p-pub] Bot state at timeout:', JSON.stringify(state));
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
    console.log('[p2p-sub] Waiting for subscriber view (20s)...');
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(20000);
    console.log('[p2p-sub] Subscriber visible in P2P session!');
  });

  it('unpublish and republish in P2P session', async () => {
    await element(by.id('tabSession')).tap();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await element(by.id('stopPublishing')).tap();
    console.log('[p2p-unpub] Unpublished.');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await element(by.id('stopPublishing')).tap();
    console.log('[p2p-unpub] Republished.');
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);
    console.log('[p2p-unpub] Publisher restored in P2P.');
  });

  it('audio-only publishing in P2P', async () => {
    await element(by.id('tabPublisher')).tap();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await element(by.id('hasVideo')).tap();
    console.log('[p2p-audio] Video off.');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await expect(element(by.id('publisher'))).toExist();

    // Restore
    await element(by.id('hasVideo')).tap();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log('[p2p-audio] Audio-only publish OK in P2P.');
  });

  it('video-only publishing in P2P', async () => {
    await element(by.id('hasAudio')).tap();
    console.log('[p2p-video] Audio off.');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await expect(element(by.id('publisher'))).toExist();

    // Restore
    await element(by.id('hasAudio')).tap();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log('[p2p-video] Video-only publish OK in P2P.');
  });
});
