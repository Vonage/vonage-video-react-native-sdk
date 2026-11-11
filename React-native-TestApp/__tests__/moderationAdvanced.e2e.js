'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');
const { TestSession } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent } = require('./helpers/eventCapture');
const { openModerationTab, resetMuteState } = require('./helpers/moderation');
const { expect: jestExpect } = require('expect');

/**
 * disableForceMute, the streamCreated payload and connectionDestroyed. Runs on the dedicated
 * moderation session; session-wide mute state is reset after every test.
 */
describe('Moderation Advanced', () => {
  let session;

  beforeAll(async () => {
    console.log('[moderationAdv] Launching app...');
    await launchAndWaitForApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    console.log('[moderationAdv] App ready.');

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

  describe('disableForceMute', () => {
    it('disableForceMute after forceMuteAll lets a new bot publish audio', async () => {
      await session.connectApp();
      const firstBot = await session.addBot();

      await openModerationTab();
      await element(by.id('muteAll')).tap();
      await firstBot.waitForPublisherAudio(false);

      await waitFor(element(by.id('disableForceMute'))).toBeVisible().withTimeout(5000);
      await element(by.id('disableForceMute')).tap();

      const secondBot = await session.addBot({ waitForSubscriber: false });
      await secondBot.waitForPublisherAudio(true);
    });
  });

  describe('forceMuteStream', () => {
    it('streamCreated payload contains expected fields', async () => {
      await session.connectApp();
      await setCaptureFilter(['streamCreated']);
      const bot = await session.addBot({ publisherOptions: { resolution: '640x480' } });
      const streamId = await bot.getPublisherStreamId();
      const connectionId = await bot.getConnectionId();

      const event = await waitForEvent('streamCreated', 15000, (e) => e.streamId === streamId);
      console.log('[moderationAdv] streamCreated payload:', JSON.stringify(event));

      // The bot publishes a 640x480 camera stream named 'bot-publisher'.
      jestExpect(event).toEqual(
        jestExpect.objectContaining({
          streamId,
          connectionId,
          name: 'bot-publisher',
          hasAudio: true,
          hasVideo: true,
          videoType: 'camera',
          width: 640,
          height: 480,
          sessionId: session.credentials.sessionId,
        })
      );
      jestExpect(typeof event.creationTime).toBe('string');
      jestExpect(Number.isNaN(Date.parse(event.creationTime))).toBe(false);
      // hasCaptions is not asserted: neither native layer puts it in the stream payload
      // (ios/Utils/EventUtils.swift prepareJSStreamEventData, android utils/EventUtils.java).
    });
  });

  describe('connection events', () => {
    it('connectionDestroyed fires when bot leaves', async () => {
      await session.connectApp();
      await setCaptureFilter(['connectionDestroyed']);
      const bot = await session.addBot();

      const connectionId = await bot.getConnectionId();
      jestExpect(connectionId).toBeTruthy();

      await bot.disconnect();

      const event = await waitForEvent('connectionDestroyed', 15000);
      jestExpect(event.connectionId).toBe(connectionId);
    });
  });
});
