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
 * Launches the app, disables Detox synchronization and waits for the UI to be ready. A failed
 * attempt (launch error or UI not ready) is retried once after terminating the app; the first
 * attempt waits less so a stuck cold start is cut short. Use it in `beforeAll` or `beforeEach`.
 *
 * @param {object} params - Passed to device.launchApp()
 */
async function launchAndWaitForApp(params) {
  const attempt = async (readyTimeout) => {
    await device.launchApp(params);
    await device.disableSynchronization();
    await waitForAppReady(readyTimeout);
  };
  try {
    await attempt(60000);
  } catch (e) {
    console.warn(`[launchApp] First attempt failed (${e.message}). Relaunching once.`);
    try {
      await device.terminateApp();
    } catch (_) {}
    await attempt(90000);
  }
}

module.exports = { waitForAppReady, launchAndWaitForApp };
