'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');
const { TestSession } = require('./helpers/testSession');
const { expect: jestExpect } = require('expect');

/**
 * The app toggles screen sharing on and off and a remote bot receives each new stream.
 */
describe('Screen Sharing', () => {
  let session;

  beforeAll(async () => {
    session = await TestSession.create();
  });

  beforeEach(async () => {
    // Relaunch so the screen sharing state of a previous test does not leak into this one
    await launchAndWaitForApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
  });

  afterAll(async () => {
    if (session) await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    if (session) await session.cleanup();
  });

  // The publisher remounts with the other video source, which destroys the old stream and
  // creates a new one, so callers wait for a new stream instead of relying on subscriberCount.
  async function toggleScreenShare() {
    await element(by.id('tabSession')).tap();
    await waitFor(element(by.id('toggleScreenShare'))).toBeVisible().withTimeout(5000);
    await element(by.id('toggleScreenShare')).tap();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);
  }

  it('screen share toggle publishes a new stream that the bot receives', async () => {
    await session.connectApp();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);

    const bot = await session.addBot();
    await bot.waitForStream();

    const streamCount = await bot.getStreamCount();
    await toggleScreenShare();
    await bot.waitForNewStream(streamCount, 30000);

    jestExpect((await bot.getState()).subscriberCount).toBeGreaterThanOrEqual(1);
  });

  it('toggling screen share off restores camera publishing to bot', async () => {
    await session.connectApp();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);

    const bot = await session.addBot();
    await bot.waitForStream();

    let streamCount = await bot.getStreamCount();
    await toggleScreenShare();
    await bot.waitForNewStream(streamCount, 30000);

    streamCount = await bot.getStreamCount();
    await toggleScreenShare();
    await bot.waitForNewStream(streamCount, 30000);

    jestExpect((await bot.getState()).subscriberCount).toBeGreaterThanOrEqual(1);
  });

  it('camera audio and video come back after a screen share round trip', async () => {
    await session.connectApp();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);

    const bot = await session.addBot();
    await bot.waitForRemoteStream({ videoType: 'camera', hasAudio: true, hasVideo: true });

    await toggleScreenShare();
    await bot.waitForRemoteStream({ videoType: 'screen', hasVideo: true });
    jestExpect(await bot.getRemoteStreams()).not.toContainEqual(
      jestExpect.objectContaining({ videoType: 'camera' })
    );

    await toggleScreenShare();
    await bot.waitForRemoteStream({ videoType: 'camera', hasAudio: true, hasVideo: true });
    await bot.waitForNoRemoteStream('screen');
  });

  async function toggleSimultaneousScreenShare() {
    await element(by.id('tabSession')).tap();
    await waitFor(element(by.id('toggleSimultaneousScreenShare'))).toBeVisible().withTimeout(5000);
    await element(by.id('toggleSimultaneousScreenShare')).tap();
  }

  // The label is drawn over the native video view, so Detox may not count it as visible on Android.
  // Reading its attributes does not depend on visibility.
  async function expectLabel(testID, text, timeout = 10000) {
    const deadline = Date.now() + timeout;
    let current = '';
    while (Date.now() < deadline) {
      const attributes = await element(by.id(testID)).getAttributes();
      current = attributes.text || attributes.label || '';
      if (current === text) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Timed out after ${timeout}ms waiting for ${testID} to read "${text}", last value "${current}"`);
  }

  async function startCameraAndBot() {
    await session.connectApp();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);
    const bot = await session.addBot();
    await bot.waitForRemoteStream({ videoType: 'camera', hasAudio: true, hasVideo: true });
    const [camera] = await bot.getRemoteStreams();
    return { bot, cameraStreamId: camera.streamId };
  }

  async function startScreenPublisher(bot) {
    await toggleSimultaneousScreenShare();
    await waitFor(element(by.id('screenPublisher'))).toExist().withTimeout(15000);
    await bot.waitForRemoteStream({ videoType: 'screen', hasVideo: true });
    const { streamId } = (await bot.getRemoteStreams()).find((s) => s.videoType === 'screen');
    // The app reports its own streamCreated a moment after the bot sees the stream.
    // Stopping before that stops a publisher that is still being established.
    await expectLabel('screenStreamId', `screen:${streamId}`);
    return streamId;
  }

  async function stopScreenPublisher(bot) {
    await toggleSimultaneousScreenShare();
    await bot.waitForNoRemoteStream('screen', 30000);
  }

  it('simultaneous mode: bot receives the camera and the screen stream together', async () => {
    const { bot, cameraStreamId } = await startCameraAndBot();

    await startScreenPublisher(bot);

    const streams = await bot.getRemoteStreams();
    jestExpect(streams).toHaveLength(2);
    jestExpect(streams).toContainEqual(
      jestExpect.objectContaining({ streamId: cameraStreamId, videoType: 'camera', hasAudio: true })
    );
    jestExpect(streams).toContainEqual(
      jestExpect.objectContaining({ videoType: 'screen', hasAudio: false })
    );
  });

  it('simultaneous mode: the camera stream keeps its id and audio while the screen publisher starts and stops twice', async () => {
    const { bot, cameraStreamId } = await startCameraAndBot();

    for (let i = 0; i < 2; i++) {
      await startScreenPublisher(bot);
      await stopScreenPublisher(bot);
      jestExpect(await bot.getRemoteStreams()).toEqual([
        jestExpect.objectContaining({ streamId: cameraStreamId, videoType: 'camera', hasAudio: true, hasVideo: true }),
      ]);
    }
  });

  it('simultaneous mode: stopping the camera publisher keeps the screen stream and reports the right stream ids', async () => {
    const { bot, cameraStreamId } = await startCameraAndBot();
    const screenStreamId = await startScreenPublisher(bot);

    await expectLabel('cameraStreamId', `camera:${cameraStreamId}`);

    await element(by.id('stopPublishing')).tap();
    await bot.waitForNoRemoteStream('camera', 30000);

    jestExpect(await bot.getRemoteStreams()).toEqual([
      jestExpect.objectContaining({ streamId: screenStreamId, videoType: 'screen' }),
    ]);
    await expectLabel('cameraStreamId', 'camera:');
    await expectLabel('screenStreamId', `screen:${screenStreamId}`);
  });

  it('camera audio and video survive three screen share round trips', async () => {
    await session.connectApp();
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);

    const bot = await session.addBot();
    await bot.waitForRemoteStream({ videoType: 'camera', hasAudio: true, hasVideo: true });

    for (let i = 0; i < 3; i++) {
      await toggleScreenShare();
      await bot.waitForRemoteStream({ videoType: 'screen', hasVideo: true });
      await toggleScreenShare();
      await bot.waitForRemoteStream({ videoType: 'camera', hasAudio: true, hasVideo: true });
      await bot.waitForNoRemoteStream('screen');
    }
  });
});
