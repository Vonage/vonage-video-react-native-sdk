'use strict';

/**
 * Waits for the test app to fully load (bundle loaded, UI rendered).
 * Polls for the submitButton to appear, with a generous timeout for CI.
 *
 * Call this after device.launchApp() + device.disableSynchronization().
 *
 * @param {number} [timeout=90000] - Max wait time in ms
 */
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

module.exports = { waitForAppReady };
