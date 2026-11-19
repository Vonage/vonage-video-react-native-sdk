'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');

const { TestSession } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent } = require('./helpers/eventCapture');
const { getCredentials } = require('./helpers/credentials');
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

  it('reports an asynchronous connect failure and can connect afterwards', async () => {
    // A validly signed token for a different session: the SDK accepts it
    // synchronously and the server rejects it asynchronously (#143).
    const otherSession = await getCredentials('relayed');

    await element(by.id('apiKeyInput')).replaceText(session.credentials.apiKey);
    await element(by.id('sessionIdInput')).replaceText(session.credentials.sessionId);
    await element(by.id('tokenInput')).replaceText(otherSession.tokenApp);
    if (session.credentials.apiUrl) {
      await element(by.id('apiUrlInput')).replaceText(session.credentials.apiUrl);
    }
    try {
      await element(by.id('mainScrollView')).tap({ x: 5, y: 5 });
    } catch (_) {}
    await element(by.id('submitButton')).tap();

    console.log('[session] Waiting for the asynchronous connect failure...');
    await waitFor(element(by.id('session-error'))).not.toHaveText('0').withTimeout(30000);
    await expect(element(by.id('session-sessionConnected'))).toHaveText('0');

    // The failed attempt must not leave the session stuck: a valid connect still works.
    console.log('[session] Connecting with a valid token...');
    await session.connectApp();
    console.log('[session] Connected after the failed attempt.');
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

});
