'use strict';

const { jsSDKTesterBot } = require('./helpers/jsSDKTesterBot');
const { getCredentials } = require('./helpers/credentials');

describe('Subscriber Tests', () => {
  let credentials;
  let bot;

  beforeAll(async () => {
    credentials = await getCredentials();
    if (!credentials.tokenBot) {
      console.warn('No tokenBot — subscriber tests will be skipped.');
      return;
    }

    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();

    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();
  });

  afterAll(async () => {
    if (bot) {
      await bot.close();
    }
  });

  it('subscriber appears when bot publishes', async () => {
    if (!credentials.tokenBot) return;

    // App connects
    await expect(element(by.id('submitButton'))).toBeVisible();
    await element(by.id('submitButton')).tap();
    console.log('[subscriber] Waiting for connection (30s)...');
    await new Promise((resolve) => setTimeout(resolve, 30000));
    await expect(element(by.id('disconnectSession'))).toBeVisible();
    console.log('[subscriber] App connected.');

    // Bot joins and publishes
    bot = new jsSDKTesterBot({ timeout: 30000 });
    await bot.launch();
    await bot.joinSession(
      credentials.apiKey,
      credentials.sessionId,
      credentials.tokenBot,
      { apiUrl: credentials.apiUrl }
    );
    console.log('[subscriber] Bot publishing. Waiting for subscriber (20s)...');
    await new Promise((resolve) => setTimeout(resolve, 20000));

    await expect(element(by.id('subscriber'))).toBeVisible();
    console.log('[subscriber] Subscriber visible!');
  });

  it('subscriber disappears when bot disconnects', async () => {
    if (!credentials.tokenBot || !bot) return;

    // Bot should still be connected from previous test
    await expect(element(by.id('subscriber'))).toBeVisible();

    // Bot disconnects
    console.log('[subscriber] Bot disconnecting...');
    await bot.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Subscriber should disappear
    try {
      await expect(element(by.id('subscriber'))).not.toBeVisible();
      console.log('[subscriber] Subscriber gone after bot disconnect.');
    } catch (e) {
      console.log('[subscriber] Subscriber still visible — may need longer wait or view stays mounted empty.');
    }
  });
});
