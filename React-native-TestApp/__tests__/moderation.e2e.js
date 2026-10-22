'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');
const { TestSession } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent } = require('./helpers/eventCapture');
const { forceDisconnect, forceMuteStream } = require('./helpers/openTokRest');
const { openModerationTab, resetMuteState } = require('./helpers/moderation');
const { itIf } = require('./helpers/itIf');
const { expect: jestExpect } = require('expect');

jest.retryTimes(1, { logErrorsBeforeRetry: true });

/**
 * Moderation Tests
 *
 * Tests moderator actions: forceMuteAll, forceDisconnect, forceMuteStream and
 * forceUnpublish. The app connects with a moderator token to a dedicated
 * moderation session; bots join per test. Session-wide mute state is reset
 * after every test.
 */
describe('Moderation', () => {
  let session;
  const isAndroid = device.getPlatform() === 'android';

  beforeAll(async () => {
    console.log('[setup] Launching app...');
    // On iOS, Detox tries to synchronize *during* launchApp() itself, which hangs
    // indefinitely when the Video SDK keeps the main queue busy. Disabling sync
    // at launch-time via launchArgs prevents this. On Android the equivalent
    // device.disableSynchronization() call below is sufficient.
    const isIOS = device.getPlatform() === 'ios';
    await launchAndWaitForApp({
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
    console.log('[setup] App ready.');

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

  it('forceMuteAll mutes the bot', async () => {
    await session.connectApp();
    const bot = await session.addBot();

    await openModerationTab();
    await element(by.id('muteAll')).tap();

    await bot.waitForPublisherAudio(false);
  });

  itIf(isAndroid, 'iOS does not deliver session muteForced to JS (issue #306)')(
    'moderator app receives muteForced after forceMuteAll',
    async () => {
      await session.connectApp();
      await setCaptureFilter(['muteForced']);
      await session.addBot();

      await openModerationTab();
      await element(by.id('muteAll')).tap();

      await waitFor(element(by.id('session-forceMute'))).not.toHaveText('0').withTimeout(10000);
      const muteEvent = await waitForEvent('muteForced', 10000);
      if (muteEvent.active !== undefined) {
        jestExpect(muteEvent.active).toBe(true);
      }
    }
  );

  it('force-disconnect bot via REST API', async () => {
    await session.connectApp();
    await setCaptureFilter(['connectionDestroyed']);
    const bot = await session.addBot();

    const connectionId = await bot.getConnectionId();
    jestExpect(connectionId).toBeTruthy();

    const { apiKey, apiSecret, apiUrl, sessionId } = session.credentials;
    await forceDisconnect(apiKey, apiSecret, apiUrl, sessionId, connectionId);

    await bot.waitForDisconnected();
    const event = await waitForEvent('connectionDestroyed', 15000);
    jestExpect(event.connectionId).toBe(connectionId);
  });

  it('forceMuteStream mutes a specific bot stream via REST', async () => {
    await session.connectApp();
    const bot = await session.addBot();

    const streamId = await bot.getPublisherStreamId();
    jestExpect(streamId).toBeTruthy();

    const { apiKey, apiSecret, apiUrl, sessionId } = session.credentials;
    await forceMuteStream(apiKey, apiSecret, apiUrl, sessionId, streamId);

    await bot.waitForPublisherAudio(false);
  });

  it('forceUnpublish removes bot stream from app', async () => {
    await session.connectApp();
    await setCaptureFilter(['streamDestroyed']);
    const bot = await session.addBot();

    const streamId = await bot.getPublisherStreamId();
    jestExpect(streamId).toBeTruthy();

    const moderatorBot = await session.addBot({
      token: session.credentials.moderatorBotToken,
      waitForSubscriber: false,
    });
    await moderatorBot.waitForStream({ streamId });

    await moderatorBot.forceUnpublish(streamId);

    const destroyedEvent = await waitForEvent('streamDestroyed', 15000);
    jestExpect(destroyedEvent.streamId).toBe(streamId);
    await waitFor(element(by.id('session-streamDestroyed'))).not.toHaveText('0').withTimeout(5000);
  });
});
