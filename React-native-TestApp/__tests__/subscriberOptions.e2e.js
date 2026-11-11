'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');

const { TestSession } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent, getLastEvent, waitForText } = require('./helpers/eventCapture');
const { runAppCommandOk, resetAppProperties } = require('./helpers/appCommand');
const { itIf } = require('./helpers/itIf');
const { expect: jestExpect } = require('expect');

const isIOS = device.getPlatform() === 'ios';
// Native subscriber video event reasons are platform specific: iOS maps OTSubscriberVideoEventReason
// (ios/Utils/Utils.swift), Android forwards the SDK's reason string unchanged.
const REASON_SUBSCRIBE_TO_VIDEO = isIOS ? 'SubscriberPropertyChanged' : 'subscribeToVideo';
const REASON_PUBLISH_VIDEO = isIOS ? 'PublisherPropertyChanged' : 'publishVideo';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Subscriber behavior with a single bot (toggles, unsubscribe, preferences, events) and with
 * several bots (multiple subscribers, disconnect behavior).
 */
describe('Subscriber Options', () => {
  let session;

  beforeAll(async () => {
    console.log('[subscriberOptions] Launching app...');
    await launchAndWaitForApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    console.log('[subscriberOptions] App ready.');

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

  /** Audio bytes the app's subscriber received over `windowMs`, from two audioNetworkStats samples. */
  async function audioBytesOver(windowMs) {
    const bytes = (e) => e && e.stats && e.stats.audioBytesReceived;
    const first = await waitForEvent('subscriberAudioNetworkStats', 15000, (e) => typeof bytes(e) === 'number');
    await sleep(windowMs);
    const second = await waitForEvent(
      'subscriberAudioNetworkStats',
      15000,
      (e) => typeof bytes(e) === 'number' && e.stats.timestamp !== first.stats.timestamp
    );
    return bytes(second) - bytes(first);
  }

  /** Requests subscriber RTC stats until the inbound video summary satisfies `predicate`. */
  async function waitForInboundVideo(predicate, label, timeout = 45000) {
    const deadline = Date.now() + timeout;
    let last = null;
    while (Date.now() < deadline) {
      await runAppCommandOk('subscriberRtcStats');
      try {
        const report = await waitForEvent(
          'subscriberRtcStatsReport',
          6000,
          (r) => Array.isArray(r.inboundVideo) && r.inboundVideo.length > 0
        );
        last = report.inboundVideo[0];
        if (predicate(last)) return last;
      } catch (_) {}
      await sleep(2000);
    }
    throw new Error(`Timed out waiting for subscriber inbound video ${label}; last ${JSON.stringify(last)}`);
  }

  describe('single bot scenarios (relayed)', () => {
    it('toggle subscribeToVideo off and on', async () => {
      await session.connectApp();
      await setCaptureFilter(['subscriberVideoDisabled', 'subscriberVideoEnabled']);
      await session.addBot();

      await element(by.id('tabSubscriber')).tap();
      await waitFor(element(by.id('toggleSubscribeVideo'))).toBeVisible().withTimeout(5000);
      await element(by.id('toggleSubscribeVideo')).tap();
      const disabled = await waitForEvent('subscriberVideoDisabled', 15000);
      jestExpect(disabled.reason).toBe(REASON_SUBSCRIBE_TO_VIDEO);
      console.log('[subVideo] videoDisabled reached JS:', JSON.stringify(disabled));

      await element(by.id('toggleSubscribeVideo')).tap();
      const enabled = await waitForEvent('subscriberVideoEnabled', 15000);
      jestExpect(enabled.reason).toBe(REASON_SUBSCRIBE_TO_VIDEO);
      jestExpect(enabled.streamId).toBe(disabled.streamId);
      console.log('[subVideo] videoEnabled reached JS:', JSON.stringify(enabled));
    });

    it('toggle subscribeToAudio off and on', async () => {
      await session.connectApp();
      await setCaptureFilter(['subscriberAudioNetworkStats']);
      await session.addBot();

      const receiving = await audioBytesOver(4000);
      jestExpect(receiving).toBeGreaterThan(0);

      await element(by.id('tabSubscriber')).tap();
      await waitFor(element(by.id('toggleSubscribeAudio'))).toBeVisible().withTimeout(5000);
      await element(by.id('toggleSubscribeAudio')).tap();
      // Let audio already in flight arrive before measuring.
      await sleep(2000);
      const stopped = await audioBytesOver(4000);
      console.log(`[subAudio] audio bytes in 4s: on=${receiving} off=${stopped}`);
      jestExpect(stopped).toBeLessThan(receiving * 0.1);

      await element(by.id('toggleSubscribeAudio')).tap();
      await sleep(2000);
      const resumed = await audioBytesOver(4000);
      console.log(`[subAudio] audio bytes in 4s after resuming: ${resumed}`);
      jestExpect(resumed).toBeGreaterThan(receiving * 0.5);
    });

    it('unsubscribe removes subscriber view', async () => {
      await session.connectApp();
      await session.addBot();

      await element(by.id('tabSubscriber')).tap();
      await waitFor(element(by.id('unsubscribe'))).toBeVisible().withTimeout(5000);
      await element(by.id('unsubscribe')).tap();
      console.log('[unsubscribe] Tapped unsubscribe.');

      await waitFor(element(by.id('subscriber'))).not.toExist().withTimeout(5000);
      console.log('[unsubscribe] Subscriber view removed.');
    });

    it('resubscribe restores subscriber view', async () => {
      await session.connectApp();
      await session.addBot();

      await element(by.id('tabSubscriber')).tap();
      await element(by.id('unsubscribe')).tap();
      await waitFor(element(by.id('subscriber'))).not.toExist().withTimeout(5000);

      await element(by.id('resubscribe')).tap();
      console.log('[resubscribe] Tapped resubscribe.');

      await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
      console.log('[resubscribe] Subscriber view restored.');
    });

    // Not automatable yet: the SDK never reads the volume back from the native subscriber
    // (OTRNSubscriberComponentView.swift / OTRNSubscriberManager.kt only set it) and exposes no
    // getter or event, so the test app cannot show the applied value.
    itIf(false, 'the RN SDK exposes no way to read the audioVolume applied to the native subscriber')(
      'audioVolume is applied to the native subscriber',
      async () => {
        await session.connectApp();
        await session.addBot();
        for (const audioVolume of [0, 50, -10, 150]) {
          await runAppCommandOk('setSubscriberProperties', { properties: { audioVolume } });
        }
      }
    );

    it('preferences reach the native subscriber', async () => {
      await session.connectApp();
      await setCaptureFilter(['subscriberRtcStatsReport', 'captionReceived']);
      await session.addBot({ publisherOptions: { resolution: '1280x720', frameRate: 30 } });

      const full = await waitForInboundVideo((v) => v.frameWidth > 640, 'wider than 640');
      console.log('[prefs] Without preferences:', JSON.stringify(full));

      await runAppCommandOk('setSubscriberProperties', { properties: { preferredResolution: '640x480' } });
      const medium = await waitForInboundVideo(
        (v) => v.frameWidth > 0 && v.frameWidth <= 640 && v.frameHeight <= 480,
        'at most 640x480'
      );
      console.log('[prefs] preferredResolution 640x480:', JSON.stringify(medium));

      await runAppCommandOk('setSubscriberProperties', {
        properties: { preferredResolution: { width: 320, height: 240 } },
      });
      const small = await waitForInboundVideo(
        (v) => v.frameWidth > 0 && v.frameWidth <= 320 && v.frameHeight <= 240,
        'at most 320x240'
      );
      console.log('[prefs] preferredResolution 320x240:', JSON.stringify(small));

      await runAppCommandOk('setSubscriberProperties', { properties: { preferredFrameRate: 7 } });
      const slow = await waitForInboundVideo(
        (v) => typeof v.framesPerSecond === 'number' && v.framesPerSecond > 0 && v.framesPerSecond <= 10,
        'at most ~7 fps'
      );
      console.log('[prefs] preferredFrameRate 7:', JSON.stringify(slow));

      // The bot publishes no captions, so this only checks that turning captions off is accepted
      // and that no caption reaches JS afterwards.
      await runAppCommandOk('setSubscriberProperties', { properties: { subscribeToCaptions: false } });
      await sleep(3000);
      jestExpect(await getLastEvent('captionReceived')).toBeNull();
    });

    it('subscriber reports videoDisabled and videoEnabled when the bot toggles video', async () => {
      await session.connectApp();
      await setCaptureFilter(['subscriberVideoDisabled', 'subscriberVideoEnabled']);
      const bot = await session.addBot();
      const botStreamId = await bot.getPublisherStreamId();

      await bot.setPublishVideo(false);
      const disabled = await waitForEvent('subscriberVideoDisabled', 15000);
      jestExpect(disabled).toEqual({ reason: REASON_PUBLISH_VIDEO, streamId: botStreamId });

      await bot.setPublishVideo(true);
      const enabled = await waitForEvent('subscriberVideoEnabled', 15000);
      jestExpect(enabled).toEqual({ reason: REASON_PUBLISH_VIDEO, streamId: botStreamId });
    });

    it('subscriber stats and rtcStatsReport events fire', async () => {
      await session.connectApp();
      await setCaptureFilter([
        'subscriberAudioLevel',
        'subscriberAudioNetworkStats',
        'subscriberVideoNetworkStats',
        'subscriberVideoDataReceived',
        'subscriberRtcStatsReport',
      ]);
      const bot = await session.addBot();
      const botStreamId = await bot.getPublisherStreamId();

      const level = await waitForEvent('subscriberAudioLevel', 15000);
      jestExpect(level.audioLevel).toBeGreaterThanOrEqual(0);
      jestExpect(level.audioLevel).toBeLessThanOrEqual(1);

      const audio = await waitForEvent('subscriberAudioNetworkStats', 15000);
      jestExpect(audio.streamId).toBe(botStreamId);
      jestExpect(audio.stats).toEqual(
        jestExpect.objectContaining({
          audioBytesReceived: jestExpect.any(Number),
          audioPacketsReceived: jestExpect.any(Number),
          audioPacketsLost: jestExpect.any(Number),
        })
      );

      const video = await waitForEvent('subscriberVideoNetworkStats', 15000);
      jestExpect(video.streamId).toBe(botStreamId);
      jestExpect(video.stats).toEqual(
        jestExpect.objectContaining({
          videoBytesReceived: jestExpect.any(Number),
          videoPacketsReceived: jestExpect.any(Number),
          videoPacketsLost: jestExpect.any(Number),
          timestamp: jestExpect.any(Number),
        })
      );

      await waitForEvent('subscriberVideoDataReceived', 15000);

      await runAppCommandOk('subscriberRtcStats');
      const fromSubscriber = await waitForEvent('subscriberRtcStatsReport', 15000);
      jestExpect(fromSubscriber.hasJsonStats).toBe(true);
      jestExpect(fromSubscriber.reportCount).toBeGreaterThan(0);
      jestExpect(fromSubscriber.inboundVideo.length).toBeGreaterThan(0);

      // Render the subscriber through OTSubscriberView children to call the view's method.
      await setCaptureFilter(['subscriberRtcStatsReport', 'subscriberConnected']);
      await runAppCommandOk('setSubscriberMode', { mode: 'views' });
      await waitForEvent('subscriberConnected', 15000, (e) => e.streamId === botStreamId);
      await runAppCommandOk('subscriberViewRtcStats');
      const fromView = await waitForEvent('subscriberRtcStatsReport', 15000);
      jestExpect(fromView.hasJsonStats).toBe(true);
      jestExpect(fromView.reportCount).toBeGreaterThan(0);
      await runAppCommandOk('setSubscriberMode', { mode: 'default' });
    });
  });

  describe('multi-bot scenarios (routed)', () => {
    it('multiple subscribers with two bots', async () => {
      await session.connectApp();

      await session.addBot();
      console.log('[multi] Bot1 joined.');
      await waitForText('subscriberConnectedCount', 'subscribersConnected:1', 15000);

      await session.addBot({ waitForSubscriber: false });
      console.log('[multi] Bot2 joined.');

      // One native subscriber per bot stream reported subscriberConnected.
      await waitForText('subscriberConnectedCount', 'subscribersConnected:2', 20000);
      console.log('[multi] Two subscriber views connected.');
    });

    it('subscriber persists after one bot disconnects', async () => {
      await session.connectApp();

      const bot1 = await session.addBot();
      console.log('[persist] Bot1 joined.');

      const bot2 = await session.addBot();
      console.log('[persist] Bot2 joined.');

      await bot2.disconnect();
      console.log('[persist] Bot2 disconnected.');

      await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
      console.log('[persist] Subscriber still visible after bot2 left.');
    });
  });
});
