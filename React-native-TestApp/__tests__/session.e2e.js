'use strict';

const { TestSession, poll } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent } = require('./helpers/eventCapture');
const { expect: jestExpect } = require('expect');

/**
 * Session Lifecycle Tests
 *
 * Tests session operations: connect/disconnect cycles,
 * disconnect while publishing/subscribing, and signal reception.
 */
describe('Session Lifecycle', () => {
  let session;

  beforeAll(async () => {
    console.log('[setup] Launching app...');
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();

    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();
    console.log('[setup] App ready.');

    session = await TestSession.create();
  });

  afterAll(async () => {
    await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    await session.cleanup();
  });

  it('connect and disconnect cleanly', async () => {
    // Connect app (defensive disconnect built-in)
    console.log('[session] Connecting...');
    await session.connectApp();
    console.log('[session] Connected.');

    // Verify session connected event indicator
    await poll(() => expect(element(by.id('session-sessionConnected'))).not.toHaveText('0'), 5000);

    // Disconnect
    console.log('[session] Disconnecting...');
    await session.disconnectApp();
    await poll(() => expect(element(by.id('submitButton'))).toBeVisible(), 5000);
    console.log('[session] Disconnected cleanly.');
  });

  it('reconnect after disconnect', async () => {
    // Connect
    console.log('[session] Connecting...');
    await session.connectApp();
    console.log('[session] Connected.');

    // Disconnect
    console.log('[session] Disconnecting...');
    await session.disconnectApp();
    await poll(() => expect(element(by.id('submitButton'))).toBeVisible(), 5000);
    console.log('[session] Disconnected.');

    // Reconnect
    console.log('[session] Reconnecting...');
    await session.connectApp();
    await poll(() => expect(element(by.id('disconnectSession'))).toBeVisible(), 30000);
    console.log('[session] Reconnected successfully.');
  });

  it('disconnect while publishing does not crash', async () => {
    // Connect app
    console.log('[session] Connecting...');
    await session.connectApp();

    // Wait for publisher to appear (confirms we are actively publishing)
    await poll(() => expect(element(by.id('publisher'))).toExist(), 30000);
    console.log('[session] Publishing. Disconnecting...');

    // Disconnect while publishing
    await session.disconnectApp();
    await poll(() => expect(element(by.id('submitButton'))).toBeVisible(), 5000);
    console.log('[session] Disconnected while publishing — no crash.');
  });

  it('disconnect while subscribing does not crash', async () => {
    // Connect app
    console.log('[session] Connecting for subscribe test...');
    await session.connectApp();

    // Set up capture for streamCreated payload verification
    await setCaptureFilter(['streamCreated']);

    // Add bot — addBot() waits for subscriber view
    console.log('[session] Adding bot...');
    const bot = await session.addBot();
    console.log('[session] Subscribing.');

    // Verify streamCreated payload contains valid stream info
    const streamEvent = await waitForEvent('streamCreated');
    console.log('[session] streamCreated payload:', JSON.stringify(streamEvent));
    jestExpect(streamEvent.streamId).toBeTruthy();

    // Disconnect while subscribing
    console.log('[session] Disconnecting...');
    await session.disconnectApp();
    await poll(() => expect(element(by.id('submitButton'))).toBeVisible(), 5000);
    console.log('[session] Disconnected while subscribing — no crash.');
  });

});
