'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');

const { TestSession } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent, getLastEvent } = require('./helpers/eventCapture');
const { expect: jestExpect } = require('expect');

/**
 * Connect/disconnect cycles and disconnecting while publishing or subscribing.
 */
describe('Session Lifecycle', () => {
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

  it('connect and disconnect cleanly', async () => {
    console.log('[session] Connecting...');
    await session.connectApp();
    console.log('[session] Connected.');

    await waitFor(element(by.id('session-sessionConnected'))).not.toHaveText('0').withTimeout(5000);

    console.log('[session] Disconnecting...');
    await session.disconnectApp();
    await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
    console.log('[session] Disconnected cleanly.');
  });

  it('reconnect after disconnect', async () => {
    console.log('[session] Connecting...');
    await session.connectApp();
    console.log('[session] Connected.');

    console.log('[session] Disconnecting...');
    await session.disconnectApp();
    await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
    console.log('[session] Disconnected.');

    console.log('[session] Reconnecting...');
    await session.connectApp();
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(30000);
    console.log('[session] Reconnected successfully.');
  });

  it('disconnect while publishing does not crash', async () => {
    console.log('[session] Connecting...');
    await session.connectApp();

    await waitFor(element(by.id('publisher'))).toExist().withTimeout(30000);
    console.log('[session] Publishing. Disconnecting...');

    await session.disconnectApp();
    await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
    console.log('[session] Disconnected while publishing — no crash.');
  });

  it('disconnect while subscribing does not crash', async () => {
    console.log('[session] Connecting for subscribe test...');
    await session.connectApp();

    await setCaptureFilter(['streamCreated']);

    console.log('[session] Adding bot...');
    const bot = await session.addBot();
    console.log('[session] Subscribing.');

    const streamEvent = await waitForEvent('streamCreated');
    console.log('[session] streamCreated payload:', JSON.stringify(streamEvent));
    jestExpect(streamEvent.streamId).toBeTruthy();

    console.log('[session] Disconnecting...');
    await session.disconnectApp();
    await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
    console.log('[session] Disconnected while subscribing — no crash.');
  });

  it('connect and disconnect 20 times without a crash', async () => {
    for (let cycle = 1; cycle <= 20; cycle++) {
      await session.connectApp();
      // Counters reset on every connect, so 1 means sessionConnected fired once in this cycle.
      await waitFor(element(by.id('session-sessionConnected'))).toHaveText('1').withTimeout(5000);
      const errors = await element(by.id('session-error')).getAttributes();
      if ((errors.text || errors.label) !== '0') {
        throw new Error(`Cycle ${cycle}: session error ${JSON.stringify(await getLastEvent('sessionError'))}`);
      }
      await session.disconnectApp();
      await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
      console.log(`[session] Cycle ${cycle}/20 done.`);
    }
    await session.connectApp();
    await waitFor(element(by.id('session-sessionConnected'))).toHaveText('1').withTimeout(5000);
  }, 900000);
});
