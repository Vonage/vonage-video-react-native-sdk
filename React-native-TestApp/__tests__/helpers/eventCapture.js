'use strict';

/**
 * Helpers for the event capture UI of the test app (VideoCallScreen): a comma-separated filter
 * of event types and one `lastEvent-{type}` element per type with the last JSON payload.
 */

/** Captures only the given event types, clearing previously captured payloads first. */
async function setCaptureFilter(eventTypes) {
  await scrollToTop();
  await element(by.id('clearCapturedEvents')).tap();
  await element(by.id('captureFilterInput')).replaceText(eventTypes.join(','));
  // On iOS replaceText leaves the keyboard open, which can intercept the tap on Set Filter.
  try {
    await element(by.id('mainScrollView')).tap({ x: 5, y: 5 });
  } catch (_) {}
  await element(by.id('setCaptureFilter')).tap();
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

/**
 * The capture and command controls are at the top of the main scroll view. Detox taps an element
 * by its screen coordinates, so a control scrolled out of view would get a tap meant for something
 * else (on a small emulator, the tab bar).
 */
async function scrollToTop() {
  // Only needed on the small Android emulator; on iOS, scrollTo waits for an idle app and hangs
  // while the Video SDK keeps it busy.
  if (device.getPlatform() !== 'android') return;
  try {
    await element(by.id('mainScrollView')).scrollTo('top');
  } catch (_) {}
}

async function clearCapturedEvents() {
  await scrollToTop();
  await element(by.id('clearCapturedEvents')).tap();
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/** Returns the parsed last payload captured for an event type, or null. */
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

/** Polls until a payload (matching `predicate`, if given) is captured for the event type, or throws after `timeout` ms. */
async function waitForEvent(eventType, timeout = 30000, predicate = () => true) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const payload = await getLastEvent(eventType);
    if (payload && predicate(payload)) return payload;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Timed out waiting for event: ${eventType}`);
}

/**
 * Polls until the element's text equals `text`. Reads attributes, so it also works for labels
 * drawn over native video views that Detox may not count as visible on Android.
 */
async function waitForText(testID, text, timeout = 10000) {
  const deadline = Date.now() + timeout;
  let current = '';
  while (Date.now() < deadline) {
    try {
      const attributes = await element(by.id(testID)).getAttributes();
      current = attributes.text || attributes.label || '';
    } catch (_) {
      current = '';
    }
    if (current === text) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out after ${timeout}ms waiting for ${testID} to read "${text}", last value "${current}"`);
}

module.exports = { setCaptureFilter, clearCapturedEvents, getLastEvent, waitForEvent, waitForText, scrollToTop };
