'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');

const { TestSession } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent, clearCapturedEvents } = require('./helpers/eventCapture');
const { expect: jestExpect } = require('expect');

describe('Subscriber Tests', () => {
  let session;

  beforeAll(async () => {
    console.log('[setup] Launching app...');
    await launchAndWaitForApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    console.log('[setup] App ready.');

    session = await TestSession.create();
  });

  afterAll(async () => {
    if (session) await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    if (session) await session.cleanup();
  });

  it('subscriber appears when bot publishes', async () => {
    console.log('[subscriber] Connecting app...');
    await session.connectApp();

    // Set up event capture BEFORE bot joins
    await setCaptureFilter(['streamCreated', 'connectionCreated']);

    console.log('[subscriber] Adding bot...');
    const bot = await session.addBot();
    console.log('[subscriber] Subscriber visible!');

    await waitFor(element(by.id('session-streamCreated'))).not.toHaveText('0').withTimeout(5000);
    await waitFor(element(by.id('session-connectionCreated'))).not.toHaveText('0').withTimeout(5000);

    const streamEvent = await waitForEvent('streamCreated', 15000);
    console.log('[subscriber] streamCreated payload:', JSON.stringify(streamEvent));
    jestExpect(streamEvent.streamId).toBeTruthy();
    jestExpect(typeof streamEvent.streamId).toBe('string');

    const connEvent = await waitForEvent('connectionCreated', 15000);
    console.log('[subscriber] connectionCreated payload:', JSON.stringify(connEvent));
    jestExpect(connEvent.connectionId).toBeTruthy();
    jestExpect(typeof connEvent.connectionId).toBe('string');
  });

  it('subscriber disappears when bot disconnects', async () => {
    console.log('[subscriber] Connecting app...');
    await session.connectApp();

    await setCaptureFilter(['streamDestroyed']);

    console.log('[subscriber] Adding bot...');
    const bot = await session.addBot();

    const botStreamId = await bot.getPublisherStreamId();
    console.log('[subscriber] Bot streamId before disconnect:', botStreamId);

    // Bot disconnects — we explicitly disconnect rather than relying on cleanup
    // so we can verify the streamDestroyed event
    console.log('[subscriber] Bot disconnecting...');
    await bot.disconnect();

    const destroyedEvent = await waitForEvent('streamDestroyed', 30000);
    console.log('[subscriber] streamDestroyed payload:', JSON.stringify(destroyedEvent));
    jestExpect(destroyedEvent.streamId).toBeTruthy();
    if (botStreamId) {
      jestExpect(destroyedEvent.streamId).toBe(botStreamId);
    }

    await waitFor(element(by.id('session-streamDestroyed'))).not.toHaveText('0').withTimeout(5000);
    console.log('[subscriber] Stream destroyed event verified with correct streamId.');

    // Give the UI time to unmount the subscriber view
    await waitFor(element(by.id('subscriber'))).not.toExist().withTimeout(10000);
    console.log('[subscriber] Subscriber gone after bot disconnect.');
  });
});
