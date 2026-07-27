'use strict';

/**
 * Waits for the test app to fully load (bundle loaded, UI rendered).
 * Polls for the submitButton to appear, with a generous timeout for CI.
 *
 * After the UI appears, waits an additional stabilization period to let
 * React Native finish layout passes and native modules initialize.
 *
 * Call this after device.launchApp() + device.disableSynchronization().
 *
 * @param {number} [timeout=180000] - Max wait time in ms (3 min for slow CI)
 * @param {number} [stabilizationDelay=3000] - Extra wait after UI appears (ms)
 */
async function waitForAppReady(timeout = 180000, stabilizationDelay = 3000) {
  const pollInterval = 2000;
  const maxAttempts = Math.ceil(timeout / pollInterval);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      await expect(element(by.id('submitButton'))).toBeVisible();
      // App UI is visible — give it time to finish layout and native module init
      await new Promise((resolve) => setTimeout(resolve, stabilizationDelay));
      return;
    } catch (e) {
      if (i === maxAttempts - 1) {
        throw new Error(`App did not become ready within ${timeout}ms (submitButton not found)`);
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }
}

module.exports = { waitForAppReady };
