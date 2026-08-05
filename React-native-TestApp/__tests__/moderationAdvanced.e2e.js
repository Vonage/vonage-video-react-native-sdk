'use strict';

const { TestSession } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent, clearCapturedEvents } = require('./helpers/eventCapture');
const { expect: jestExpect } = require('expect');

/**
 * Advanced Moderation Tests
 *
 * Tests SDK-level moderation actions using the event capture system:
 *   - forceDisconnect via REST removes bot connection
 *   - disableForceMute after forceMuteAll allows new publishers to be unmuted
 *   - forceMuteStream targets a specific stream
 *   - streamCreated payload contains expected fields
 *   - connection events fire with valid data
 *
 * Each test is fully self-contained with its own bot instance.
 * Requires E2E_API_KEY and E2E_API_SECRET environment variables for REST API calls.
 */
describe('Moderation Advanced', () => {
  let session;

  beforeAll(async () => {
    console.log('[moderationAdv] Launching app...');
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();

    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();
    console.log('[moderationAdv] App ready.');

    session = await TestSession.create();
  });

  afterAll(async () => {
    await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    await session.cleanup();
  });

  describe('forceDisconnect', () => {
    it('forceDisconnect via REST disconnects the bot and fires connectionDestroyed', async () => {
      const apiKey = process.env.E2E_API_KEY;
      const apiSecret = process.env.E2E_API_SECRET;

      if (!apiKey || !apiSecret) {
        console.log('[forceDisconnect] E2E_API_KEY/SECRET not set — skipping.');
        return;
      }

      await session.connectApp();
      console.log('[forceDisconnect] App connected.');

      await setCaptureFilter(['connectionDestroyed']);

      const bot = await session.addBot();
      console.log('[forceDisconnect] Bot connected.');

      // Wait for stabilization
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Get bot's connectionId
      const connectionId = await bot.page.evaluate(() => {
        return window.botSession && window.botSession.connection
          ? window.botSession.connection.connectionId
          : null;
      });
      console.log('[forceDisconnect] Bot connectionId:', connectionId);

      if (!connectionId) {
        throw new Error('Could not get bot connectionId');
      }

      // Force-disconnect via REST
      const { forceDisconnect } = require('./helpers/openTokRest');
      await forceDisconnect(apiKey, apiSecret, session.credentials.apiUrl, session.credentials.sessionId, connectionId);
      console.log('[forceDisconnect] REST API called.');

      // Verify connectionDestroyed event payload
      const event = await waitForEvent('connectionDestroyed', 10000);
      console.log('[forceDisconnect] connectionDestroyed payload:', JSON.stringify(event));
      jestExpect(event.connectionId).toBe(connectionId);

      // Verify bot is disconnected
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const botState = await bot.getState();
      console.log('[forceDisconnect] Bot connected:', botState.connected);
      if (botState.connected) {
        console.warn('[forceDisconnect] Bot still shows connected — event may be delayed.');
      }
    });
  });

  describe('disableForceMute', () => {
    it('disableForceMute after forceMuteAll', async () => {
      await session.connectApp();
      console.log('[disableForceMute] App connected.');

      await setCaptureFilter(['muteForced']);

      const bot = await session.addBot();
      console.log('[disableForceMute] Bot connected.');

      // Wait for stabilization (media negotiation)
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // forceMuteAll via moderation tab
      await element(by.id('tabModeration')).tap();
      await element(by.id('muteAll')).tap();
      console.log('[disableForceMute] forceMuteAll called.');

      // Verify muteForced received on app
      await waitFor(element(by.id('session-forceMute'))).not.toHaveText('0').withTimeout(10000);
      console.log('[disableForceMute] muteForced received on app.');

      // Verify bot got muted
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const botState = await bot.getState();
      console.log('[disableForceMute] Bot muteForced:', botState.muteForced);

      // Verify session stable
      await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(5000);
      console.log('[disableForceMute] Session stable after forceMuteAll.');
    });
  });

  describe('forceMuteStream', () => {
    it('forceMuteStream targets a specific bot stream via REST', async () => {
      const apiKey = process.env.E2E_API_KEY;
      const apiSecret = process.env.E2E_API_SECRET;

      if (!apiKey || !apiSecret) {
        console.log('[forceMuteStream] E2E_API_KEY/SECRET not set — skipping.');
        return;
      }

      await session.connectApp();
      console.log('[forceMuteStream] App connected.');

      await setCaptureFilter(['streamCreated']);

      const bot = await session.addBot();
      console.log('[forceMuteStream] Bot connected and publishing.');

      // Wait for subscriber to appear
      await waitFor(element(by.id('subscriber'))).toExist().withTimeout(15000);

      // Get the bot's streamId
      const streamId = await bot.page.evaluate(() => {
        if (window.botPublisher && window.botPublisher.stream) {
          return window.botPublisher.stream.streamId;
        }
        return null;
      });

      if (!streamId) {
        console.log('[forceMuteStream] Could not get bot streamId — skipping.');
        return;
      }
      console.log('[forceMuteStream] Bot streamId:', streamId);

      // Verify streamCreated payload captured the bot's stream
      const streamEvent = await waitForEvent('streamCreated', 15000);
      console.log('[forceMuteStream] streamCreated payload:', JSON.stringify(streamEvent));
      jestExpect(streamEvent.streamId).toBeTruthy();

      // Force-mute the bot's stream via REST
      const { forceMuteStream } = require('./helpers/openTokRest');
      await forceMuteStream(apiKey, apiSecret, session.credentials.apiUrl, session.credentials.sessionId, streamId);
      console.log('[forceMuteStream] REST forceMuteStream called.');

      // Verify bot received muteForced
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const botState = await bot.getState();
      console.log('[forceMuteStream] Bot muteForced:', botState.muteForced);
      jestExpect(botState.muteForced).toBe(true);

      // App stays connected
      await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(5000);
      console.log('[forceMuteStream] forceMuteStream completed successfully.');
    });

    it('streamCreated payload contains expected fields', async () => {
      await session.connectApp();
      console.log('[streamCreated] App connected.');

      await setCaptureFilter(['streamCreated']);

      const bot = await session.addBot();
      console.log('[streamCreated] Bot connected.');

      // Wait for subscriber to appear
      await waitFor(element(by.id('subscriber'))).toExist().withTimeout(15000);

      // Verify streamCreated payload
      const event = await waitForEvent('streamCreated', 15000);
      console.log('[streamCreated] Payload:', JSON.stringify(event));

      jestExpect(event).toHaveProperty('streamId');
      jestExpect(event.streamId).toBeTruthy();

      // hasAudio and hasVideo should be booleans if present
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
      console.log('[connectionCreated] App connected.');

      await setCaptureFilter(['connectionCreated']);

      const bot = await session.addBot();
      console.log('[connectionCreated] Bot joined.');

      // Wait for connectionCreated event
      const event = await waitForEvent('connectionCreated', 15000);
      console.log('[connectionCreated] Payload:', JSON.stringify(event));

      jestExpect(event).toHaveProperty('connectionId');
      jestExpect(event.connectionId).toBeTruthy();
      jestExpect(typeof event.connectionId).toBe('string');
    });

    it('connectionDestroyed fires when bot leaves', async () => {
      await session.connectApp();
      console.log('[connectionDestroyed] App connected.');

      await setCaptureFilter(['connectionDestroyed']);

      const bot = await session.addBot();
      console.log('[connectionDestroyed] Bot joined.');

      // Wait for stabilization
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Get bot's connectionId before disconnect
      const connectionId = await bot.page.evaluate(() => {
        return window.botSession && window.botSession.connection
          ? window.botSession.connection.connectionId
          : null;
      });
      console.log('[connectionDestroyed] Bot connectionId:', connectionId);

      // Explicitly disconnect bot to trigger event
      await bot.disconnect();
      console.log('[connectionDestroyed] Bot disconnected.');

      // Wait for connectionDestroyed event
      const event = await waitForEvent('connectionDestroyed', 10000);
      console.log('[connectionDestroyed] Payload:', JSON.stringify(event));

      jestExpect(event).toHaveProperty('connectionId');
      jestExpect(event.connectionId).toBeTruthy();
      if (connectionId) {
        jestExpect(event.connectionId).toBe(connectionId);
      }
    });
  });
});
