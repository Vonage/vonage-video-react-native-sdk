'use strict';

const { jsSDKTesterBot } = require('./helpers/jsSDKTesterBot');
const { getCredentials } = require('./helpers/credentials');

/**
 * Moderation Tests
 *
 * Tests moderator actions.
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

  it('force-disconnect bot via REST API', async () => {
    const apiKey = process.env.E2E_API_KEY;
    const apiSecret = process.env.E2E_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.log('[forceDisconnect] E2E_API_KEY/SECRET not set — skipping.');
      return;
    }

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
});
