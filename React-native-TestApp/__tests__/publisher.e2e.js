'use strict';

const { VonageBot } = require('./helpers/VonageBot');
const { getCredentials } = require('./helpers/credentials');
const jestExpect = require('expect');

describe('Basic Connectivity', () => {
  let credentials;
  let bot;

  beforeAll(async () => {
    console.log('[beforeAll] Starting...');

    try {
      console.log('[beforeAll] Getting credentials...');
      credentials = await getCredentials();
      console.log('[beforeAll] Credentials OK. sessionId:', credentials.sessionId);
    } catch (e) {
      console.error('[beforeAll] Credentials FAILED:', e.message);
      throw e;
    }

    console.log('[beforeAll] Launching app...');
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();
    console.log('[beforeAll] App launched. Waiting 5s...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log('[beforeAll] Done.');
  });

  afterAll(async () => {
    if (bot) {
      await bot.close();
    }
  });

  it('app publishes stream and bot receives it', async () => {
    // App connects
    await expect(element(by.id('submitButton'))).toBeVisible();
    console.log('[test1] Tapping submit...');
    await element(by.id('submitButton')).tap();

    console.log('[test1] Waiting 30s for connection...');
    await new Promise((resolve) => setTimeout(resolve, 30000));

    await expect(element(by.id('disconnectSession'))).toBeVisible();
    await expect(element(by.id('publisher'))).toBeVisible();
    console.log('[test1] App connected and publishing.');

    // Now launch bot and join
    console.log('[test1] Launching bot...');
    bot = new VonageBot({ timeout: 30000 });
    await bot.launch();

    console.log('[test1] Bot joining session...');
    await bot.joinSession(
      credentials.apiKey,
      credentials.sessionId,
      credentials.tokenBot,
      { apiUrl: credentials.apiUrl }
    );
    console.log('[test1] Bot connected. Waiting for subscriber...');

    await bot.waitForSubscriber(20000);
    const state = await bot.getState();
    console.log('[test1] Bot received stream! subscriberCount:', state.subscriberCount);
  });

  it('bot publishes stream and app shows subscriber', async () => {
    // Bot is already publishing from previous test
    console.log('[test2] Waiting 15s for app to show subscriber...');
    await new Promise((resolve) => setTimeout(resolve, 15000));

    await expect(element(by.id('subscriber'))).toBeVisible();
    console.log('[test2] Subscriber visible!');
  });
});
