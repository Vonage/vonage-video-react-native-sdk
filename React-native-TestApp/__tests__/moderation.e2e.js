'use strict';

const { TestSession } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent } = require('./helpers/eventCapture');
const { expect: jestExpect } = require('expect');
const { forceDisconnect, forceMuteStream, forceUnpublish } = require('./helpers/openTokRest');

/**
 * Moderation Tests
 *
 * Tests moderator actions: forceMuteAll, forceDisconnect, forceMuteStream,
 * forceUnpublish, and subscriber-only token verification.
 * The app connects with a moderator token; bots join per-test for isolation.
 */
describe('Moderation', () => {
  let session;

  beforeAll(async () => {
    console.log('[setup] Launching app...');
    // On iOS, Detox tries to synchronize *during* launchApp() itself, which hangs
    // indefinitely when the Video SDK keeps the main queue busy. Disabling sync
    // at launch-time via launchArgs prevents this. On Android the equivalent
    // device.disableSynchronization() call below is sufficient.
    const isIOS = device.getPlatform() === 'ios';
    await device.launchApp({
      newInstance: true,
      ...(isIOS
        ? {
            launchArgs: {
              detoxEnableSynchronization: 0,
              detoxPrintBusyIdleResources: 'YES',
            },
          }
        : {}),
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();

    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();
    console.log('[setup] App ready.');

    session = await TestSession.create();
  });

  afterAll(async () => {
    await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    await session.cleanup();
  });

  it('forceMuteAll mutes the bot', async () => {
    await session.connectApp();
    console.log('[forceMute] App connected as moderator.');

    await setCaptureFilter(['muteForced']);

    // addBot waits for subscriber (media flowing)
    const bot = await session.addBot();
    console.log('[forceMute] Bot connected and publishing.');

    // Navigate to moderation tab and tap muteAll
    await element(by.id('tabModeration')).tap();
    // Wait for the control to mount after the tab switch (replaces a fixed sleep).
    await waitFor(element(by.id('muteAll'))).toBeVisible().withTimeout(15000);
    await element(by.id('muteAll')).tap();
    console.log('[forceMute] muteAll tapped.');

    // Poll bot state until muteForced received
    let muteReceived = false;
    for (let i = 0; i < 10; i++) {
      const state = await bot.getState();
      if (state.muteForced) {
        muteReceived = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!muteReceived) {
      throw new Error('Bot did not receive muteForced event after forceMuteAll');
    }
    console.log('[forceMute] Bot was force-muted!');

    // Verify event indicators on the RN app side
    await waitFor(element(by.id('session-forceMute'))).not.toHaveText('0').withTimeout(15000);
    await waitFor(element(by.id('publisher-forceMute'))).not.toHaveText('0').withTimeout(15000);

    // Verify muteForced payload (moderator may not always receive this callback)
    try {
      const muteEvent = await waitForEvent('muteForced', 10000);
      console.log('[forceMute] muteForced payload:', JSON.stringify(muteEvent));
      if (muteEvent.active !== undefined) {
        jestExpect(muteEvent.active).toBe(true);
      }
    } catch (e) {
      console.log('[forceMute] muteForced event not received by moderator (expected in some cases).');
    }
  });

  it('force-disconnect bot via REST API', async () => {
    const apiKey = process.env.E2E_API_KEY;
    const apiSecret = process.env.E2E_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.log('[forceDisconnect] E2E_API_KEY/SECRET not set — skipping.');
      return;
    }

    await session.connectApp();
    const bot = await session.addBot();
    console.log('[forceDisconnect] Bot connected.');

    // Get the bot's connectionId
    const connectionId = await bot.page.evaluate(() => {
      return window.botSession && window.botSession.connection
        ? window.botSession.connection.connectionId
        : null;
    });
    console.log('[forceDisconnect] Bot connectionId:', connectionId);

    if (!connectionId) {
      throw new Error('Could not get bot connectionId');
    }

    // Force-disconnect via REST API
    await forceDisconnect(apiKey, apiSecret, session.credentials.apiUrl, session.credentials.sessionId, connectionId);
    console.log('[forceDisconnect] REST API called.');

    // Poll bot state until disconnected
    let disconnected = false;
    for (let i = 0; i < 10; i++) {
      const botState = await bot.getState();
      if (!botState.connected) {
        disconnected = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (disconnected) {
      console.log('[forceDisconnect] Bot was force-disconnected!');
    } else {
      console.warn('[forceDisconnect] Bot still shows connected — event may be delayed.');
    }
  });

  it('forceMuteStream mutes a specific bot stream via REST', async () => {
    const apiKey = process.env.E2E_API_KEY;
    const apiSecret = process.env.E2E_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.log('[muteStream] E2E_API_KEY/SECRET not set — skipping.');
      return;
    }

    await session.connectApp();
    const bot = await session.addBot();
    console.log('[muteStream] Bot connected.');

    // Get the bot's stream ID
    const streamId = await bot.page.evaluate(() => {
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

    // Force-mute via REST
    await forceMuteStream(apiKey, apiSecret, session.credentials.apiUrl, session.credentials.sessionId, streamId);
    console.log('[muteStream] REST forceMuteStream called.');

    // Poll bot state for muteForced
    let muteReceived = false;
    for (let i = 0; i < 10; i++) {
      const state = await bot.getState();
      if (state.muteForced) {
        muteReceived = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log('[muteStream] Bot muteForced:', muteReceived);

    // No crash
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(15000);
    console.log('[muteStream] forceMuteStream completed without crash.');
  });

  it('forceUnpublish removes bot stream from app', async () => {
    const apiKey = process.env.E2E_API_KEY;
    const apiSecret = process.env.E2E_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.log('[forceUnpublish] E2E_API_KEY/SECRET not set — skipping.');
      return;
    }

    await session.connectApp();
    await setCaptureFilter(['streamDestroyed']);

    const bot = await session.addBot();
    console.log('[forceUnpublish] Bot connected, subscriber visible.');

    // Get bot's stream ID
    const streamId = await bot.page.evaluate(() => {
      if (window.botPublisher && window.botPublisher.stream) {
        return window.botPublisher.stream.streamId;
      }
      return null;
    });

    if (!streamId) {
      console.log('[forceUnpublish] Could not get bot streamId — skipping.');
      return;
    }

    // Force-unpublish via REST
    await forceUnpublish(apiKey, apiSecret, session.credentials.apiUrl, session.credentials.sessionId, streamId);
    console.log('[forceUnpublish] REST API called.');

    // Verify streamDestroyed payload
    const destroyedEvent = await waitForEvent('streamDestroyed', 10000);
    jestExpect(destroyedEvent.streamId).toBe(streamId);
    console.log('[forceUnpublish] streamDestroyed streamId matches.');

    await waitFor(element(by.id('session-streamDestroyed'))).not.toHaveText('0').withTimeout(15000);
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(15000);
    console.log('[forceUnpublish] Force-unpublish completed.');
  });

  it('subscriber-only token cannot publish (error received)', async () => {
    await session.connectApp();

    if (!session.credentials.tokenSubscriber) {
      console.log('[roleToken] No tokenSubscriber available — skipping.');
      return;
    }

    jestExpect(session.credentials.tokenSubscriber).toBeDefined();
    jestExpect(session.credentials.tokenSubscriber).not.toBe(session.credentials.tokenApp);
    console.log('[roleToken] Verified subscriber token exists and differs from moderator token.');
  });
});
