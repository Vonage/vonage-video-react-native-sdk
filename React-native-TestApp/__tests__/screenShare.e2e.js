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
});
