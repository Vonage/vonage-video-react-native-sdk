'use strict';

/**
 * Event Capture helpers for E2E tests.
 *
 * Works with the capture system in VideoCallScreen:
 *   - captureFilterInput (TextInput) — comma-separated event types
 *   - setCaptureFilter (Text/button) — applies the filter
 *   - clearCapturedEvents (Text/button) — clears captured payloads
 *   - lastEvent-{type} (hidden Text) — last JSON payload per type
 */

/**
 * Configures which event types the app should capture.
 * Clears previously captured events first (to avoid stale data), then applies
 * the new filter. Must be called while connected to a session — the capture
 * controls only exist on the connected screen.
 * Waits for the filter to propagate through React's setState before returning.
 * @param {string[]} eventTypes - e.g. ['signal', 'streamPropertyChanged']
 */
async function setCaptureFilter(eventTypes) {
  // The capture controls render after connection; wait for the first one to
  // mount before tapping, so we don't race the connected-screen render.
  await waitFor(element(by.id('clearCapturedEvents')))
    .toBeVisible()
    .withTimeout(15000);
  await element(by.id('clearCapturedEvents')).tap();
  await element(by.id('captureFilterInput')).replaceText(eventTypes.join(','));
  // Dismiss keyboard before tapping Set Filter — on iOS, replaceText leaves
  // the keyboard open which can intercept the tap on Set Filter button.
  try {
    await element(by.id('mainScrollView')).tap({ x: 5, y: 5 });
  } catch (_) {}
  await element(by.id('setCaptureFilter')).tap();
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

/**
 * Reads the last captured payload for a given event type.
 * Returns the parsed JSON object, or null if not yet captured.
 * @param {string} eventType - e.g. 'signal'
 * @returns {Promise<object|null>}
 */
async function getLastEvent(eventType) {
  try {
    const attrs = await element(by.id(`lastEvent-${eventType}`)).getAttributes();
    const text = attrs.text || attrs.label || '';
    if (!text) return null;
    // The rendered text is "{type}: {json}" — strip the prefix
    const colonIndex = text.indexOf(': ');
    const jsonStr = colonIndex >= 0 ? text.substring(colonIndex + 2) : text;
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

/**
 * Polls until a captured event payload appears, or times out.
 * @param {string} eventType - e.g. 'signal'
 * @param {number} [timeout=30000] - max wait in ms
 * @returns {Promise<object>} the parsed event payload
 */
async function waitForEvent(eventType, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const payload = await getLastEvent(eventType);
    if (payload) return payload;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Timed out waiting for event: ${eventType}`);
}

module.exports = { setCaptureFilter, getLastEvent, waitForEvent };
