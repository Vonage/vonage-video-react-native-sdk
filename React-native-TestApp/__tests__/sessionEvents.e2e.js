'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');
const { TestSession } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent } = require('./helpers/eventCapture');
const { runAppCommandOk } = require('./helpers/appCommand');
const { startArchive, stopArchive } = require('./helpers/openTokRest');
const { itIf } = require('./helpers/itIf');
const { expect: jestExpect } = require('expect');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Session-level events and errors that OTSession delivers to eventHandlers. */
describe('Session Events', () => {
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
    if (session) await session.cleanup();
  });

  /** Connects with a bad value and checks that eventHandlers.error fired exactly once. */
  async function expectConnectError(options) {
    const error = await session.connectAppExpectingError(options);
    jestExpect(error.code).toBeDefined();
    jestExpect(error.code).not.toBeNull();
    jestExpect(typeof error.message).toBe('string');
    jestExpect(error.message.length).toBeGreaterThan(0);
    // A second report of the same failure would arrive within a few seconds.
    await sleep(3000);
    await waitFor(element(by.id('session-error'))).toHaveText('1').withTimeout(2000);
    await waitFor(element(by.id('session-sessionConnected'))).toHaveText('0').withTimeout(1000);
    await session.disconnectApp();
    return error;
  }

  it('connect errors are reported through eventHandlers.error', async () => {
    const tokenError = await expectConnectError({ token: 'T1==invalid-token' });
    console.log('[sessionEvents] Invalid token error:', JSON.stringify(tokenError));

    const sessionIdError = await expectConnectError({ sessionId: '2_MX4xMjM0NTY3OH5-invalid-session-id' });
    console.log('[sessionEvents] Invalid session ID error:', JSON.stringify(sessionIdError));

    // A valid connect still works afterwards.
    await session.connectApp();
    await waitFor(element(by.id('session-sessionConnected'))).toHaveText('1').withTimeout(5000);
  });

  // Split from the test above, which covers the invalid token and session ID cases.
  itIf(false, 'the test cannot cut the network of the iOS simulator or the CI emulator')(
    'connect without network reports an error',
    async () => {
      await expectConnectError({});
    }
  );

  it('getCapabilities matches the token role', async () => {
    const roles = [
      {
        role: 'moderator',
        token: session.credentials.tokenApp,
        expected: { canPublish: true, canSubscribe: true, canForceMute: true, canForceDisconnect: true },
      },
      {
        role: 'publisher',
        token: session.credentials.publisherTokenApp,
        expected: { canPublish: true, canSubscribe: true, canForceMute: false, canForceDisconnect: false },
      },
      {
        role: 'subscriber',
        token: session.credentials.subscriberTokenApp,
        expected: { canPublish: false, canSubscribe: true, canForceMute: false, canForceDisconnect: false },
      },
    ];
    for (const { role, token, expected } of roles) {
      await session.connectApp({ token });
      const capabilities = await runAppCommandOk('getCapabilities');
      console.log(`[sessionEvents] ${role} capabilities:`, JSON.stringify(capabilities));
      jestExpect(capabilities).toEqual(expected);
      await session.disconnectApp();
    }
  });

  it('archiveStarted and archiveStopped fire', async () => {
    await session.connectApp();
    await waitFor(element(by.id('publisher-streamCreated'))).not.toHaveText('0').withTimeout(30000);
    await setCaptureFilter(['archiveStarted', 'archiveStopped']);

    const { apiKey, apiSecret, apiUrl, sessionId } = session.credentials;
    const name = `rn-e2e-archive-${Date.now()}`;
    const archive = await startArchive(apiKey, apiSecret, apiUrl, sessionId, name);
    console.log('[sessionEvents] Archive started via REST:', JSON.stringify({ id: archive.id, name: archive.name }));

    let stopped = false;
    try {
      const startedEvent = await waitForEvent('archiveStarted', 30000);
      jestExpect(startedEvent).toEqual({ archiveId: archive.id, name: archive.name, sessionId });

      await stopArchive(apiKey, apiSecret, apiUrl, archive.id);
      stopped = true;
      const stoppedEvent = await waitForEvent('archiveStopped', 30000);
      jestExpect(stoppedEvent).toEqual({ archiveId: archive.id, name: archive.name, sessionId });
    } finally {
      // A running archive would make the retry's startArchive fail with 409.
      if (!stopped) await stopArchive(apiKey, apiSecret, apiUrl, archive.id).catch(() => {});
    }
  });

  it('streamPropertyChanged reports hasAudio, hasVideo and videoDimensions with sessionId', async () => {
    await session.connectApp();
    await setCaptureFilter(['streamPropertyChanged']);
    const bot = await session.addBot({ canvasVideo: { width: 320, height: 240 } });
    const streamId = await bot.getPublisherStreamId();
    const { sessionId } = session.credentials;

    await bot.setPublishAudio(false);
    const audio = await waitForEvent('streamPropertyChanged', 20000, (e) => e.changedProperty === 'hasAudio');
    jestExpect(audio).toEqual({ changedProperty: 'hasAudio', oldValue: true, newValue: false, streamId, sessionId });

    await bot.setPublishVideo(false);
    const video = await waitForEvent('streamPropertyChanged', 20000, (e) => e.changedProperty === 'hasVideo');
    jestExpect(video).toEqual({ changedProperty: 'hasVideo', oldValue: true, newValue: false, streamId, sessionId });

    await bot.setPublishVideo(true);
    await waitForEvent(
      'streamPropertyChanged',
      20000,
      (e) => e.changedProperty === 'hasVideo' && e.newValue === true
    );

    await bot.resizeCanvasVideo(640, 480);
    const dimensions = await waitForEvent(
      'streamPropertyChanged',
      30000,
      (e) => e.changedProperty === 'videoDimensions'
    );
    jestExpect(dimensions).toEqual({
      changedProperty: 'videoDimensions',
      oldValue: { width: 320, height: 240 },
      newValue: { width: 640, height: 480 },
      streamId,
      sessionId,
    });
  });
});
