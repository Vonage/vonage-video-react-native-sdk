'use strict';
const { launchAppWithRetry } = require('./helpers/waitForApp');
const { TestSession } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent } = require('./helpers/eventCapture');
const { forceDisconnect, forceMuteStream } = require('./helpers/openTokRest');
const {
  openModerationTab,
  waitForPublisherAudio,
  waitForBotDisconnected,
  resetMuteState,
} = require('./helpers/moderation');
const { expect: jestExpect } = require('expect');

jest.retryTimes(1, { logErrorsBeforeRetry: true });

/**
 * Advanced Moderation Tests
 *
 * Tests SDK-level moderation actions using the event capture system:
 *   - forceDisconnect via REST removes bot connection
 *   - disableForceMute after forceMuteAll allows new publishers to publish audio
 *   - forceMuteStream targets a specific stream
 *   - streamCreated payload contains expected fields
 *   - connection events fire with valid data
 *
 * Runs against the dedicated moderation session. Each test is self-contained
 * with its own bots, and session-wide mute state is reset after every test.
 */
describe('Moderation Advanced', () => {
  let session;

  beforeAll(async () => {
    console.log('[moderationAdv] Launching app...');
    await launchAppWithRetry({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();

    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();
    console.log('[moderationAdv] App ready.');

    session = await TestSession.createModeration();
  });

  afterAll(async () => {
    if (session) await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    if (!session) return;
    try {
      await resetMuteState(session);
    } finally {
      await session.cleanup();
    }
  });

  describe('forceDisconnect', () => {
    it('forceDisconnect via REST disconnects the bot and fires connectionDestroyed', async () => {
      await session.connectApp();
      await setCaptureFilter(['connectionDestroyed']);
      const bot = await session.addBot();

      const connectionId = await bot.getConnectionId();
      jestExpect(connectionId).toBeTruthy();

      const { apiKey, apiSecret, apiUrl, sessionId } = session.credentials;
      await forceDisconnect(apiKey, apiSecret, apiUrl, sessionId, connectionId);

      const event = await waitForEvent('connectionDestroyed', 15000);
      jestExpect(event.connectionId).toBe(connectionId);
      await waitForBotDisconnected(bot);
    });
  });

  describe('disableForceMute', () => {
    it('disableForceMute after forceMuteAll lets a new bot publish audio', async () => {
      await session.connectApp();
      const firstBot = await session.addBot();

      await openModerationTab();
      await element(by.id('muteAll')).tap();
      await waitForPublisherAudio(firstBot, false);

      await waitFor(element(by.id('disableForceMute'))).toBeVisible().withTimeout(5000);
      await element(by.id('disableForceMute')).tap();

      const secondBot = await session.addBot({ waitForSubscriber: false });
      await waitForPublisherAudio(secondBot, true);
    });
  });

  describe('forceMuteStream', () => {
    it('forceMuteStream targets a specific bot stream via REST', async () => {
      await session.connectApp();
      await setCaptureFilter(['streamCreated']);
      const bot = await session.addBot();

      const streamId = await bot.getPublisherStreamId();
      jestExpect(streamId).toBeTruthy();

      const streamEvent = await waitForEvent('streamCreated', 15000);
      jestExpect(streamEvent.streamId).toBeTruthy();

      const { apiKey, apiSecret, apiUrl, sessionId } = session.credentials;
      await forceMuteStream(apiKey, apiSecret, apiUrl, sessionId, streamId);

      await waitForPublisherAudio(bot, false);
    });

    it('streamCreated payload contains expected fields', async () => {
      await session.connectApp();
      await setCaptureFilter(['streamCreated']);
      await session.addBot();

      const event = await waitForEvent('streamCreated', 15000);
      jestExpect(event).toHaveProperty('streamId');
      jestExpect(event.streamId).toBeTruthy();

      if (event.hasAudio !== undefined) {
        jestExpect(typeof event.hasAudio).toBe('boolean');
      }
      if (event.hasVideo !== undefined) {
        jestExpect(typeof event.hasVideo).toBe('boolean');
      }
    });
  });

  describe('connection events', () => {
    it('connectionCreated fires with valid connectionId when bot joins', async () => {
      await session.connectApp();
      await setCaptureFilter(['connectionCreated']);
      await session.addBot();

      const event = await waitForEvent('connectionCreated', 15000);
      jestExpect(event).toHaveProperty('connectionId');
      jestExpect(typeof event.connectionId).toBe('string');
      jestExpect(event.connectionId).toBeTruthy();
    });

    it('connectionDestroyed fires when bot leaves', async () => {
      await session.connectApp();
      await setCaptureFilter(['connectionDestroyed']);
      const bot = await session.addBot();

      const connectionId = await bot.getConnectionId();
      jestExpect(connectionId).toBeTruthy();

      await bot.disconnect();

      const event = await waitForEvent('connectionDestroyed', 15000);
      jestExpect(event.connectionId).toBe(connectionId);
    });
  });
});
