'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');

describe('App Launch Test', () => {
  beforeAll(async () => {
    await launchAndWaitForApp({
      newInstance: true,
      launchArgs: {
        detoxPrintBusyIdleResources: 'YES',
      },
      permissions: { camera: 'YES', microphone: 'YES' },
    });
  });

  afterAll(async () => {
    // Stop instrumentation before Detox tears down its client and ADB forwarding.
    await device.terminateApp();
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

  it('should connect and disconnect a session', async () => {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('Waiting for apiKeyInput to be visible...');
    const apiKeyInput = element(by.id('apiKeyInput'));
    await waitFor(apiKeyInput).toBeVisible().withTimeout(60000);
    console.log('apiKeyInput is visible');

    await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(30000);

    console.log('About to tap submit button');

    await element(by.id('submitButton')).tap();

    console.log('Tapped submit button, waiting for connection');

    await new Promise((resolve) => setTimeout(resolve, 15000));

    try {
      await expect(element(by.id('disconnectSession'))).toBeVisible();
      console.log('Session connected - disconnect button found');
    } catch (e) {
      console.log('Disconnect button not found - session may not have connected');
      try {
        await expect(element(by.id('submitButton'))).toBeVisible();
        console.log('Submit button still visible - connection likely failed');
      } catch (e2) {
        console.log('Neither submit nor disconnect button visible');
      }
      throw e;
    }

    try {
      await expect(element(by.id('publisher'))).toBeVisible();
    } catch (e) {
      console.log('Publisher not visible - may be permissions issue or rendering issue');
    }

    await element(by.id('disconnectSession')).tap();

    await new Promise((resolve) => setTimeout(resolve, 3000));

    await expect(element(by.id('submitButton'))).toBeVisible();
  });
});
