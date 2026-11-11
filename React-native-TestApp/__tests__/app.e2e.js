'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');
const { TestSession } = require('./helpers/testSession');
const { expect: jestExpect } = require('expect');

describe('App Launch Test', () => {
  let session;

  beforeAll(async () => {
    await launchAndWaitForApp({
      newInstance: true,
      launchArgs: {
        detoxPrintBusyIdleResources: 'YES',
      },
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    session = await TestSession.create();
  });

  afterAll(async () => {
    if (session) await session.teardown();
    await device.enableSynchronization();
  });

  afterEach(async () => {
    if (session) await session.cleanup();
  });

  it('should launch the app successfully', async () => {
    // Wait for the initial Metro bundle load to complete before issuing a reload
    console.log('Waiting for initial bundle load before reload...');
    await new Promise((resolve) => setTimeout(resolve, 10000));

    console.log('Calling reloadReactNative...');
    await device.reloadReactNative();
    console.log('reloadReactNative returned, waiting for UI to appear...');

    try {
      await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(240000);
      console.log('App launched successfully — "submitButton" is visible');
    } catch (error) {
      console.log('Could not find "submitButton":', error.message);

      try {
        const isManualVisible = await element(by.text('Manual')).isVisible();
        console.log('"Manual" element visible:', isManualVisible);
      } catch (e) {
        console.log('Could not check "Manual" element:', e.message);
      }

      throw error;
    }
  });

  it('JS reload while connected tears down the native session', async () => {
    await session.connectApp();
    const bot = await session.addBot();
    await bot.waitForRemoteStream({ videoType: 'camera', hasAudio: true, hasVideo: true });
    const [oldStream] = await bot.getRemoteStreams();
    jestExpect(oldStream.connectionId).toBeTruthy();

    await device.reloadReactNative();
    await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(240000);

    // The reload must disconnect the native session that the old JS bundle created.
    await bot.waitForConnectionDestroyed(oldStream.connectionId, 30000);
    await bot.waitForStreamDestroyed(oldStream.streamId, 30000);

    // A new connect works and can publish again (the camera is not held by the old publisher).
    const streamCount = await bot.getStreamCount();
    await session.connectApp();
    await bot.waitForNewStream(streamCount, 30000);
    await bot.waitForRemoteStream({ videoType: 'camera', hasAudio: true, hasVideo: true });
    const streams = await bot.getRemoteStreams();
    jestExpect(streams).toHaveLength(1);
    jestExpect(streams[0].connectionId).not.toBe(oldStream.connectionId);
    jestExpect(streams[0].streamId).not.toBe(oldStream.streamId);
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(5000);
  });
});
