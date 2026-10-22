'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');
const { TestSession } = require('./helpers/testSession');
const { expect: jestExpect } = require('expect');

jest.retryTimes(1, { logErrorsBeforeRetry: true });

/**
 * Screen Sharing Tests
 *
 * Verifies that the RN app can toggle screen sharing on and off,
 * and that a remote bot receives the screen share stream.
 */
// Skipped since 8ee55b8. On iOS the screen share stream is never created because publish() is
// dropped when the native publisher view has not created the publisher yet.
describe.skip('Screen Sharing', () => {
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
});
