'use strict';

const { TestSession } = require('./helpers/testSession');

/**
 * Calling-services bridge Tests
 *
 * Drives the "Calling" tab through the CallKit / ConnectionService audio
 * lifecycle and checks every bridge method resolves on both platforms.
 * This proves the JS -> native wiring; audio on a real answered call still
 * needs a physical device and a VoIP push.
 */
describe('Calling services', () => {
  let session;

  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();

    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();

    session = await TestSession.create({ timeout: 30000 });
    await session.connectApp();
    await element(by.id('tabCalling')).tap();
  });

  afterAll(async () => {
    await session.teardown();
    // Calling-services mode is process-wide on iOS; don't leak it to other suites.
    await device.terminateApp();
  });

  const expectResult = async (text) => {
    await waitFor(element(by.id('csLastResult')))
      .toHaveText(text)
      .withTimeout(10000);
  };

  it('reports calling-services mode as available', async () => {
    await element(by.id('csAvailable')).tap();
    await expectResult('csAvailable: ok true');
  });

  it('runs the full call audio lifecycle without errors', async () => {
    await element(by.id('csRunSequence')).tap();
    await expectResult('sequence: ok');
  });
});
