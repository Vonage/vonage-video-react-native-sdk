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
    await new Promise((resolve) => setTimeout(resolve, 10000));
  });

  afterAll(async () => {
    if (bot) await bot.close();
  });

  it('forceMuteAll mutes the bot', async () => {
    // Verify subscriber is visible (bot is publishing)
    await expect(element(by.id('subscriber'))).toExist();
    console.log('[forceMute] Subscriber exists. Scrolling to muteAll...');

    // Scroll to controls area
    await element(by.id('mainScrollView')).swipe('up', 'slow', 0.5);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Tap muteAll
    try {
      await element(by.id('muteAll')).tap();
    } catch (e) {
      // Try one more scroll
      await element(by.id('mainScrollView')).swipe('up', 'slow', 0.3);
      await new Promise((resolve) => setTimeout(resolve, 500));
      await element(by.id('muteAll')).tap();
    }

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
});
