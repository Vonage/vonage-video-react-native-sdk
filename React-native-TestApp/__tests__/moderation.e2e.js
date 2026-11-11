'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');
const { TestSession } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent } = require('./helpers/eventCapture');
const { openModerationTab, resetMuteState } = require('./helpers/moderation');
const { runAppCommand } = require('./helpers/appCommand');
const { expect: jestExpect } = require('expect');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Moderation calls made by the app through OTSession (forceMuteAll, forceMuteStream,
 * forceDisconnect), and a force mute of the app's own publisher by a moderator bot. Runs on the
 * dedicated moderation session; session-wide mute state is reset after every test.
 */
describe('Moderation', () => {
  let session;

  beforeAll(async () => {
    console.log('[setup] Launching app...');
    // On iOS, Detox synchronizes during launchApp() and hangs while the Video SDK keeps the main queue busy
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

  async function addTwoBots() {
    const botA = await session.addBot();
    const botB = await session.addBot({ waitForSubscriber: false });
    const streamA = await botA.getPublisherStreamId();
    const streamB = await botB.getPublisherStreamId();
    jestExpect(streamA).toBeTruthy();
    jestExpect(streamB).toBeTruthy();
    // The app needs both streams before it can resolve their ids natively.
    await waitFor(element(by.id('session-streamCreated'))).toHaveText('2').withTimeout(15000);
    return { botA, botB, streamA, streamB };
  }

  it('forceMuteAll mutes the bot', async () => {
    await session.connectApp();
    const bot = await session.addBot();

    await openModerationTab();
    await element(by.id('muteAll')).tap();

    await bot.waitForPublisherAudio(false);
  });

  it('moderator app receives muteForced after forceMuteAll', async () => {
    await session.connectApp();
    await setCaptureFilter(['muteForced']);
    await session.addBot();
    await openModerationTab();
    await element(by.id('muteAll')).tap();
    await waitFor(element(by.id('session-forceMute'))).not.toHaveText('0').withTimeout(10000);
    await waitForEvent('muteForced', 10000, (event) => event.active === true);
  });

  it('forceMuteAll with excluded streams mutes only the other bots', async () => {
    await session.connectApp();
    const { botA, botB, streamA } = await addTwoBots();

    const result = await runAppCommand('forceMuteAll', { excludedStreamIds: [streamA] });
    jestExpect(result).toEqual(jestExpect.objectContaining({ ok: true }));

    await botB.waitForPublisherAudio(false);
    jestExpect(await botA.getPublisherState()).toEqual({ hasAudio: true, hasVideo: true });
  });

  it('forceMuteStream from the app mutes one bot', async () => {
    await session.connectApp();
    const { botA, botB, streamA } = await addTwoBots();

    const result = await runAppCommand('forceMuteStream', { streamId: streamA });
    jestExpect(result).toEqual(jestExpect.objectContaining({ ok: true }));

    await botA.waitForPublisherAudio(false);
    jestExpect(await botB.getPublisherState()).toEqual({ hasAudio: true, hasVideo: true });
  });

  it('app publisher receives muteForced when the moderator bot mutes it', async () => {
    await session.connectApp({ token: session.credentials.publisherTokenApp });
    await setCaptureFilter(['publisherMuteForced']);
    const moderatorBot = await session.addBot({ token: session.credentials.moderatorBotToken });
    await moderatorBot.waitForRemoteStream({ videoType: 'camera', hasAudio: true });
    const [appStream] = await moderatorBot.getRemoteStreams();

    await moderatorBot.forceMuteStream(appStream.streamId);

    await waitForEvent('publisherMuteForced', 15000);
    await moderatorBot.waitForRemoteStream({ hasAudio: false }, 15000);

    // The app turns its audio back on through the publishAudio prop.
    let result = await runAppCommand('setPublisherProperties', { properties: { publishAudio: false } });
    jestExpect(result.ok).toBe(true);
    result = await runAppCommand('setPublisherProperties', { properties: { publishAudio: true } });
    jestExpect(result.ok).toBe(true);
    await moderatorBot.waitForRemoteStream({ hasAudio: true }, 15000);
  });

  it('forceDisconnect from the app disconnects the bot', async () => {
    await session.connectApp();
    await setCaptureFilter(['connectionDestroyed']);
    const bot = await session.addBot();
    const connectionId = await bot.getConnectionId();
    jestExpect(connectionId).toBeTruthy();

    const result = await runAppCommand('forceDisconnect', { connectionId });
    jestExpect(result).toEqual(jestExpect.objectContaining({ ok: true }));

    await bot.waitForDisconnected();
    const event = await waitForEvent('connectionDestroyed', 15000);
    jestExpect(event.connectionId).toBe(connectionId);
  });

  it('moderation calls without moderator rights report an error', async () => {
    await session.connectApp({ token: session.credentials.publisherTokenApp });
    const bot = await session.addBot();
    const streamId = await bot.getPublisherStreamId();
    const connectionId = await bot.getConnectionId();

    // An error reaches JS either as a rejected promise or through eventHandlers.error.
    const expectError = async (op, args) => {
      await setCaptureFilter([]);
      const result = await runAppCommand(op, args);
      if (result.ok) {
        const sessionError = await waitForEvent('sessionError', 10000).catch(() => null);
        if (!sessionError) {
          throw new Error(`${op} without moderator rights resolved and no session error was reported`);
        }
      } else {
        jestExpect(result.error.message).toBeTruthy();
      }
    };

    await expectError('forceMuteAll', { excludedStreamIds: [] });
    await expectError('forceMuteStream', { streamId });
    await expectError('forceDisconnect', { connectionId });

    // Nobody was muted or disconnected.
    await sleep(2000);
    jestExpect(await bot.getPublisherState()).toEqual({ hasAudio: true, hasVideo: true });
    jestExpect((await bot.getState()).connected).toBe(true);

    // After disconnecting, the call fails instead of crashing.
    const afterDisconnect = await runAppCommand('afterDisconnect', {
      command: { op: 'forceMuteAll', excludedStreamIds: [] },
    });
    jestExpect(afterDisconnect.ok).toBe(false);
    jestExpect(afterDisconnect.error.message).toBeTruthy();
    await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
  });
});
