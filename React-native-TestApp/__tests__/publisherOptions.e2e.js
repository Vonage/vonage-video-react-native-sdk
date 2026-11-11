'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');

const { TestSession } = require('./helpers/testSession');
const { expect: jestExpect } = require('expect');

/**
 * Publisher toggles and unpublish/republish, checked from a bot that subscribes to the app's
 * stream. The app stays connected for the whole spec; each test adds its own bot.
 */
describe('Publisher Options', () => {
  let session;

  beforeAll(async () => {
    await launchAndWaitForApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });

    session = await TestSession.create();
    await session.connectApp();
    console.log('[publisherOptions] Connected.');

    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);
    console.log('[publisherOptions] Publisher active.');
  });

  afterAll(async () => {
    if (session) await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    if (session) await session.teardown();
  });

  async function addBotSeeingAppStream() {
    const bot = await session.addBot({ waitForSubscriber: false });
    await bot.waitForRemoteStream({ videoType: 'camera', hasAudio: true, hasVideo: true });
    const [stream] = await bot.getRemoteStreams();
    return { bot, streamId: stream.streamId };
  }

  it('toggle audio off then on (mute/unmute)', async () => {
    const { bot, streamId } = await addBotSeeingAppStream();

    await element(by.id('tabPublisher')).tap();
    await waitFor(element(by.id('hasAudio'))).toBeVisible().withTimeout(5000);
    await element(by.id('hasAudio')).tap();
    await bot.waitForRemoteStream({ hasAudio: false, hasVideo: true });
    console.log('[audio] Bot sees the stream muted.');

    await element(by.id('hasAudio')).tap();
    await bot.waitForRemoteStream({ hasAudio: true, hasVideo: true });
    console.log('[audio] Bot sees the stream unmuted.');

    jestExpect(await bot.getRemoteStreams()).toEqual([
      jestExpect.objectContaining({ streamId, hasAudio: true, hasVideo: true }),
    ]);
  });

  it('toggle video off then on (camera off/on)', async () => {
    const { bot, streamId } = await addBotSeeingAppStream();

    await element(by.id('tabPublisher')).tap();
    await waitFor(element(by.id('hasVideo'))).toBeVisible().withTimeout(5000);
    await element(by.id('hasVideo')).tap();
    await bot.waitForRemoteStream({ hasAudio: true, hasVideo: false });
    console.log('[video] Bot sees the camera off.');

    await element(by.id('hasVideo')).tap();
    await bot.waitForRemoteStream({ hasAudio: true, hasVideo: true });
    console.log('[video] Bot sees the camera on.');

    jestExpect(await bot.getRemoteStreams()).toEqual([
      jestExpect.objectContaining({ streamId, hasAudio: true, hasVideo: true }),
    ]);
  });

  it('unpublish then republish', async () => {
    const { bot, streamId: oldStreamId } = await addBotSeeingAppStream();

    await element(by.id('tabSession')).tap();
    await waitFor(element(by.id('stopPublishing'))).toBeVisible().withTimeout(5000);
    await element(by.id('stopPublishing')).tap();
    await bot.waitForStreamDestroyed(oldStreamId);
    console.log('[unpublish] Bot saw the old stream destroyed.');

    const streamCount = await bot.getStreamCount();
    await element(by.id('stopPublishing')).tap();
    await bot.waitForNewStream(streamCount, 30000);
    await bot.waitForRemoteStream({ videoType: 'camera', hasAudio: true, hasVideo: true });

    const streams = await bot.getRemoteStreams();
    jestExpect(streams).toHaveLength(1);
    jestExpect(streams[0].streamId).not.toBe(oldStreamId);
    jestExpect(streams[0]).toEqual(jestExpect.objectContaining({ hasAudio: true, hasVideo: true }));
    console.log('[unpublish] Bot receives the republished stream.');
  });
});
