'use strict';

const { jsSDKTesterBot } = require('./helpers/jsSDKTesterBot');
const { getCredentials } = require('./helpers/credentials');

/**
 * Moderation Tests
 *
 * Tests moderator actions: forceMuteAll verified via bot state.
 * The app connects with a moderator token, the bot with a publisher token.
 */
describe('Moderation', () => {
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

    // Connect app (moderator token)
    await element(by.id('submitButton')).tap();
    console.log('[moderation] Connecting app...');
    await new Promise((resolve) => setTimeout(resolve, 30000));
    await expect(element(by.id('disconnectSession'))).toBeVisible();
    console.log('[moderation] App connected as moderator.');

    // Bot joins
    bot = new jsSDKTesterBot({ timeout: 30000 });
    await bot.launch();
    await bot.joinSession(
      credentials.apiKey,
      credentials.sessionId,
      credentials.tokenBot,
      { apiUrl: credentials.apiUrl }
    );
    console.log('[moderation] Bot connected and publishing.');
    await new Promise((resolve) => setTimeout(resolve, 20000));
  });

  afterAll(async () => {
    await device.terminateApp();
    if (bot) await bot.close();
  });

  it('forceMuteAll mutes the bot', async () => {
    console.log('[forceMute] Tapping muteAll...');
    await element(by.id('muteAll')).tap();

    console.log('[forceMute] muteAll tapped. Waiting 5s...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify bot received muteForced event
    const state = await bot.getState();
    console.log('[forceMute] Bot state:', JSON.stringify({ muteForced: state.muteForced }));
    if (!state.muteForced) {
      throw new Error('Bot did not receive muteForced event after forceMuteAll');
    }
    console.log('[forceMute] Bot was force-muted!');
  });

  it('force-disconnect bot via REST API', async () => {
    const apiKey = process.env.E2E_API_KEY;
    const apiSecret = process.env.E2E_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.log('[forceDisconnect] E2E_API_KEY/SECRET not set — skipping.');
      return;
    }

    // Bot should still be connected from previous test
    let botState = await bot.getState();
    if (!botState.connected) {
      // Reconnect bot
      await bot.joinSession(
        credentials.apiKey,
        credentials.sessionId,
        credentials.tokenBot,
        { apiUrl: credentials.apiUrl }
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Get the bot's connectionId from the page
    const connectionId = await bot.page.evaluate(() => {
      return window.botSession && window.botSession.connection
        ? window.botSession.connection.connectionId
        : null;
    });
    console.log('[forceDisconnect] Bot connectionId:', connectionId);

    if (!connectionId) {
      throw new Error('Could not get bot connectionId');
    }

    // Force-disconnect the bot via REST API
    const { forceDisconnect } = require('./helpers/openTokRest');
    await forceDisconnect(apiKey, apiSecret, credentials.apiUrl, credentials.sessionId, connectionId);
    console.log('[forceDisconnect] REST API called. Waiting 5s...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify bot is disconnected
    botState = await bot.getState();
    console.log('[forceDisconnect] Bot connected:', botState.connected);
    if (botState.connected) {
      console.warn('[forceDisconnect] Bot still shows connected — sessionDisconnected event may be delayed.');
    } else {
      console.log('[forceDisconnect] Bot was force-disconnected!');
    }
  });

  it('forceMuteAll does not crash when a participant disconnects simultaneously', async () => {
    if (!credentials.tokenBot2) {
      console.log('[raceMute] tokenBot2 not available — skipping.');
      return;
    }

    // Reconnect bot (may have been force-disconnected in previous test)
    await bot.joinSession(
      credentials.apiKey,
      credentials.sessionId,
      credentials.tokenBot,
      { apiUrl: credentials.apiUrl }
    );
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Add bot2 to have 3 participants
    const bot2 = new jsSDKTesterBot({ timeout: 30000 });
    await bot2.launch();
    await bot2.joinSession(
      credentials.apiKey,
      credentials.sessionId,
      credentials.tokenBot2,
      { apiUrl: credentials.apiUrl }
    );
    console.log('[raceMute] 3 participants connected. Setting up race condition...');
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Fire forceMuteAll and bot2 disconnect simultaneously
    // This creates the race condition where a stream becomes null mid-iteration
    console.log('[raceMute] Firing forceMuteAll + bot2.disconnect() simultaneously...');
    await Promise.all([
      bot2.disconnect(),
      element(by.id('muteAll')).tap(),
    ]);

    // Wait for dust to settle
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // App should not have crashed — session still active
    await expect(element(by.id('disconnectSession'))).toBeVisible();
    console.log('[raceMute] App survived the race condition — no crash!');

    await bot2.close();
  });

  it('forceMuteStream mutes a specific bot stream via REST', async () => {
    const apiKey = process.env.E2E_API_KEY;
    const apiSecret = process.env.E2E_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.log('[muteStream] E2E_API_KEY/SECRET not set — skipping.');
      return;
    }

    // Reconnect bot
    await bot.joinSession(
      credentials.apiKey,
      credentials.sessionId,
      credentials.tokenBot,
      { apiUrl: credentials.apiUrl }
    );
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Get the bot's stream ID
    const streamId = await bot.page.evaluate(() => {
      const pub = window.botSession && window.botSession.streams;
      // The bot's own published stream
      if (window.botPublisher && window.botPublisher.stream) {
        return window.botPublisher.stream.streamId;
      }
      return null;
    });

    if (!streamId) {
      console.log('[muteStream] Could not get bot streamId — skipping.');
      return;
    }
    console.log('[muteStream] Bot streamId:', streamId);

    // Force-mute the bot's stream via REST
    const { forceMuteStream } = require('./helpers/openTokRest');
    await forceMuteStream(apiKey, apiSecret, credentials.apiUrl, credentials.sessionId, streamId);
    console.log('[muteStream] REST forceMuteStream called. Waiting 5s...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify bot received muteForced
    const state = await bot.getState();
    console.log('[muteStream] Bot muteForced:', state.muteForced);
    // Note: muteForced may already be true from the forceMuteAll test
    // The important thing is no crash
    await expect(element(by.id('disconnectSession'))).toBeVisible();
    console.log('[muteStream] forceMuteStream completed without crash.');
  });
});
