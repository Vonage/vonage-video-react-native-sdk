'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');
const { TestSession } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent, getLastEvent } = require('./helpers/eventCapture');
const { runAppCommand, runAppCommandOk, resetAppProperties } = require('./helpers/appCommand');
const { itIf } = require('./helpers/itIf');
const { expect: jestExpect } = require('expect');

// The iOS simulator and the CI Android emulator have no camera, so the publisher sends no video
// frames and its RTC stats carry no resolution, frame rate or codec. Set E2E_HAS_CAMERA=1 on a
// device or an emulator with a camera to run the stats checks.
const HAS_CAMERA = process.env.E2E_HAS_CAMERA === '1';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const INIT_PROPERTIES = {
  name: 'rn-pub',
  resolution: '1280x720',
  frameRate: 15,
  audioBitrate: 32000,
  maxVideoBitrate: 500000,
  videoBitratePreset: 'bw_saver',
  videoContentHint: 'detail',
  degradationPreference: 1,
  preferredVideoCodecs: ['vp9'],
  enableDtx: true,
  publishSenderStats: true,
  audioFallback: { publisher: true },
  allowAudioCaptureWhileMuted: false,
  audioTrack: true,
  videoTrack: true,
};

/** OTPublisher properties, from first render to runtime changes, checked from a bot. */
describe('Publisher Properties', () => {
  let session;

  beforeAll(async () => {
    await launchAndWaitForApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    session = await TestSession.create();
  });

  afterAll(async () => {
    if (session) await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    if (!session) return;
    await resetAppProperties();
    await session.cleanup();
  });

  /** Republishes with `properties` as init properties and returns the stream the bot receives. */
  async function republish(bot, properties) {
    const previous = await bot.getRemoteStreams();
    const streamCount = await bot.getStreamCount();
    await runAppCommandOk('republish', { properties });
    for (const stream of previous) await bot.waitForStreamDestroyed(stream.streamId, 30000);
    await bot.waitForNewStream(streamCount, 30000);
    const streams = await bot.getRemoteStreams();
    jestExpect(streams).toHaveLength(1);
    return streams[0];
  }

  it('publish requested before the native publisher exists is kept', async () => {
    // The bot is in the session first, so it sees every stream the app creates.
    const bot = await session.addBot({ waitForSubscriber: false });

    // The app renders OTSession and OTPublisher together on its first render.
    await session.connectApp();
    await bot.waitForRemoteStream({ videoType: 'camera', hasAudio: true, hasVideo: true }, 30000);
    await waitFor(element(by.id('publisher-streamCreated'))).toHaveText('1').withTimeout(10000);

    // A publish request replayed twice would create a second stream shortly after the first.
    await sleep(5000);
    jestExpect(await bot.getStreamCount()).toBe(1);
    jestExpect(await bot.getRemoteStreams()).toHaveLength(1);
    await waitFor(element(by.id('publisher-streamCreated'))).toHaveText('1').withTimeout(1000);
  });

  it('init properties reach the native publisher and the stream', async () => {
    await session.connectApp();
    const bot = await session.addBot({ waitForSubscriber: false });
    await bot.waitForRemoteStream({ videoType: 'camera' }, 30000);
    await setCaptureFilter(['publisherError']);

    const full = await republish(bot, INIT_PROPERTIES);
    jestExpect(full).toEqual(jestExpect.objectContaining({ name: 'rn-pub', hasAudio: true, hasVideo: true }));

    const noAudioTrack = await republish(bot, { audioTrack: false, videoTrack: true });
    jestExpect(noAudioTrack).toEqual(jestExpect.objectContaining({ name: 'rn-pub', hasAudio: false, hasVideo: true }));

    const noVideoTrack = await republish(bot, { audioTrack: true, videoTrack: false });
    jestExpect(noVideoTrack).toEqual(jestExpect.objectContaining({ name: 'rn-pub', hasAudio: true, hasVideo: false }));

    jestExpect(await getLastEvent('publisherError')).toBeNull();
  });

  itIf(HAS_CAMERA, 'needs a camera: the simulator/emulator publisher sends no video frames')(
    'init properties show in the publisher RTC stats',
    async () => {
      await session.connectApp();
      const bot = await session.addBot({ waitForSubscriber: false });
      await bot.waitForRemoteStream({ videoType: 'camera' }, 30000);
      await republish(bot, INIT_PROPERTIES);
      await setCaptureFilter(['publisherRtcStatsReport']);

      const deadline = Date.now() + 45000;
      let summary = null;
      while (Date.now() < deadline) {
        await runAppCommandOk('publisherRtcStats');
        summary = await waitForEvent('publisherRtcStatsReport', 10000).catch(() => null);
        const video = summary && summary.outboundVideo && summary.outboundVideo.find((v) => v.frameWidth > 0);
        if (video && video.framesPerSecond > 0) break;
        await sleep(3000);
      }
      const video = summary.outboundVideo.filter((v) => v.frameWidth > 0);
      jestExpect(video.length).toBeGreaterThan(0);
      for (const layer of video) {
        jestExpect(layer.codec).toBe('video/VP9');
        jestExpect(layer.frameWidth).toBeLessThanOrEqual(1280);
        jestExpect(layer.frameHeight).toBeLessThanOrEqual(720);
        jestExpect(layer.framesPerSecond).toBeLessThanOrEqual(16);
      }
      const videoTarget = video.reduce((sum, layer) => sum + (layer.targetBitrate || 0), 0);
      jestExpect(videoTarget).toBeLessThanOrEqual(500000);
      const audio = summary.outboundAudio[0];
      jestExpect(audio.targetBitrate).toBeLessThanOrEqual(32000);
    }
  );

  it('runtime prop changes apply without republishing', async () => {
    await session.connectApp();
    const bot = await session.addBot({ waitForSubscriber: false });
    await bot.waitForRemoteStream({ videoType: 'camera', hasAudio: true, hasVideo: true }, 30000);
    const [{ streamId }] = await bot.getRemoteStreams();
    const streamCount = await bot.getStreamCount();
    await setCaptureFilter(['publisherError']);

    const change = (properties) => runAppCommandOk('setPublisherProperties', { properties });

    await change({ publishAudio: false });
    await bot.waitForRemoteStream({ hasAudio: false, hasVideo: true });
    await change({ publishAudio: true });
    await bot.waitForRemoteStream({ hasAudio: true, hasVideo: true });
    await change({ publishVideo: false });
    await bot.waitForRemoteStream({ hasAudio: true, hasVideo: false });
    await change({ publishVideo: true });
    await bot.waitForRemoteStream({ hasAudio: true, hasVideo: true });

    for (const properties of [
      { cameraPosition: 'front' },
      { cameraTorch: true },
      { cameraTorch: false },
      { cameraZoomFactor: 2 },
      { cameraZoomFactor: 1 },
      { videoBitratePreset: 'extra_bw_saver' },
      { maxVideoBitrate: 300000 },
    ]) {
      await change(properties);
    }
    await sleep(3000);

    const publisherError = await getLastEvent('publisherError');
    if (publisherError) console.log('[runtime] Publisher error during the changes:', JSON.stringify(publisherError));
    jestExpect(await bot.getStreamCount()).toBe(streamCount);
    jestExpect(await bot.getRemoteStreams()).toEqual([
      jestExpect.objectContaining({ streamId, hasAudio: true, hasVideo: true }),
    ]);
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(5000);
  });

  it('mistyped properties are coerced without a crash', async () => {
    await session.connectApp();
    const bot = await session.addBot({ waitForSubscriber: false });
    await bot.waitForRemoteStream({ videoType: 'camera' }, 30000);

    const numericName = await republish(bot, { name: 12345 });
    jestExpect(['12345', '']).toContain(numericName.name);

    const emptyVideoTrack = await republish(bot, { name: 'rn-pub', videoTrack: '' });
    jestExpect(emptyVideoTrack.name).toBe('rn-pub');
    jestExpect(typeof emptyVideoTrack.hasVideo).toBe('boolean');

    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('publisher'))).toExist().withTimeout(5000);
  });

  it('stats, audioLevel and rtcStatsReport events fire', async () => {
    await session.connectApp();
    await setCaptureFilter([
      'publisherAudioLevel',
      'publisherAudioNetworkStats',
      'publisherVideoNetworkStats',
      'publisherRtcStatsReport',
    ]);
    const bot = await session.addBot({ waitForSubscriber: false });
    await bot.waitForRemoteStream({ videoType: 'camera' }, 30000);

    const level = await waitForEvent('publisherAudioLevel', 15000);
    jestExpect(level.audioLevel).toBeGreaterThanOrEqual(0);
    jestExpect(level.audioLevel).toBeLessThanOrEqual(1);

    const first = (payload) => (Array.isArray(payload) ? payload[0] : payload);
    const audio = first(await waitForEvent('publisherAudioNetworkStats', 20000));
    jestExpect(audio).toEqual(
      jestExpect.objectContaining({
        audioBytesSent: jestExpect.any(Number),
        audioPacketsSent: jestExpect.any(Number),
        timestamp: jestExpect.any(Number),
      })
    );
    const video = first(await waitForEvent('publisherVideoNetworkStats', 20000));
    jestExpect(video).toEqual(
      jestExpect.objectContaining({
        videoBytesSent: jestExpect.any(Number),
        videoPacketsSent: jestExpect.any(Number),
        timestamp: jestExpect.any(Number),
      })
    );

    await setCaptureFilter(['publisherRtcStatsReport']);
    const result = await runAppCommand('publisherRtcStats');
    jestExpect(result.ok).toBe(true);
    const report = await waitForEvent('publisherRtcStatsReport', 15000);
    jestExpect(report.entries).toBeGreaterThan(0);
    jestExpect(report.reportCount).toBeGreaterThan(0);
  });
});
