'use strict';

/** Polls until the connection form is visible (bundle loaded, UI rendered). */
async function waitForAppReady(timeout = 90000) {
  const pollInterval = 2000;
  const maxAttempts = Math.ceil(timeout / pollInterval);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      await expect(element(by.id('submitButton'))).toBeVisible();
      return; // App is ready
    } catch (e) {
      if (i === maxAttempts - 1) {
        throw new Error(`App did not become ready within ${timeout}ms (submitButton not found)`);
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }
}

/**
 * Launches the app (one retry after terminating it if the first launch fails), disables Detox
 * synchronization and waits for the UI to be ready. Use it in `beforeAll` or `beforeEach`.
 *
 * @param {object} params - Passed to device.launchApp()
 */
async function launchAndWaitForApp(params) {
  try {
    await device.launchApp(params);
  } catch (e) {
    console.warn(`[launchApp] First launch failed (${e.message}). Retrying once.`);
    try {
      await device.terminateApp();
    } catch (_) {}
    await device.launchApp(params);
  }
  await device.disableSynchronization();
  await waitForAppReady();
}

module.exports = { waitForAppReady, launchAndWaitForApp };
