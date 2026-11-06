'use strict';

const { TestSession } = require('./helpers/testSession');

// Checks every calling-services bridge method resolves on both platforms.
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
    // Mode is process-wide on iOS; reset it for other suites.
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
