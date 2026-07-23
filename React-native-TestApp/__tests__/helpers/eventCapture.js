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
 * @param {string[]} eventTypes - e.g. ['signal', 'streamPropertyChanged']
 */
async function setCaptureFilter(eventTypes) {
  await element(by.id('captureFilterInput')).replaceText(eventTypes.join(','));
  await element(by.id('setCaptureFilter')).tap();
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * Clears all previously captured event payloads.
 */
async function clearCapturedEvents() {
  await element(by.id('clearCapturedEvents')).tap();
  await new Promise((resolve) => setTimeout(resolve, 500));
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
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for event: ${eventType}`);
}

module.exports = { setCaptureFilter, clearCapturedEvents, getLastEvent, waitForEvent };
