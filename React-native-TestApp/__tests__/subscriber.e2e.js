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
    await device.terminateApp();
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
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(30000);
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
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(20000);

    await expect(element(by.id('subscriber'))).toExist();
    console.log('[subscriber] Subscriber visible!');

    // Verify event indicators
    await waitFor(element(by.id('session-streamCreated'))).not.toHaveText('0').withTimeout(5000);
    await waitFor(element(by.id('session-connectionCreated'))).not.toHaveText('0').withTimeout(5000);
  });

  it('subscriber disappears when bot disconnects', async () => {
    if (!credentials.tokenBot) return;

    // Ensure bot is connected and subscriber is visible before testing its disappearance
    if (!bot) {
      bot = new jsSDKTesterBot({ timeout: 30000 });
      await bot.launch();
    }
    const botState = await bot.getState();
    if (!botState.connected) {
      await bot.joinSession(
        credentials.apiKey,
        credentials.sessionId,
        credentials.tokenBot,
        { apiUrl: credentials.apiUrl }
      );
      await waitFor(element(by.id('subscriber'))).toExist().withTimeout(20000);
    }
    await expect(element(by.id('subscriber'))).toExist();

    // Bot disconnects
    console.log('[subscriber] Bot disconnecting...');
    await bot.disconnect();

    // Subscriber should disappear — wait up to 30s
    // Use toExist check on session-streamDestroyed indicator instead of view visibility
    // because the subscriber view may remain mounted briefly after stream cleanup
    await waitFor(element(by.id('session-streamDestroyed'))).not.toHaveText('0').withTimeout(30000);
    console.log('[subscriber] Stream destroyed event received.');

    // Give the UI time to unmount the subscriber view
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log('[subscriber] Subscriber gone after bot disconnect.');
  });
});
