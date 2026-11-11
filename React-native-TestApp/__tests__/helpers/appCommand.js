'use strict';

const { waitForEvent } = require('./eventCapture');
const { withTimeout } = require('./timeout');

let nextId = 1;

/**
 * Runs a command in the test app (VideoCallScreen `executeCommand`): the app calls the public SDK
 * API on its OTSession / OTPublisher / OTSubscriber refs and reports a `commandResult` event.
 * Resolves with `{ id, op, ok, value }` or `{ id, op, ok: false, error: { code, message } }`;
 * it does not throw when the SDK call fails, so tests can assert on errors.
 *
 * @param {string} op - Command name, e.g. 'signal', 'forceMuteAll', 'applyVideoFilter'
 * @param {object} [args] - Command arguments
 * @param {number} [timeout=20000] - How long to wait for the result (ms)
 */
async function runAppCommand(op, args = {}, timeout = 20000) {
  const id = `${Date.now()}-${nextId++}`;
  await element(by.id('commandInput')).replaceText(JSON.stringify({ id, op, ...args }));
  // On iOS replaceText leaves the keyboard open, which can intercept the tap on Run.
  try {
    await element(by.id('mainScrollView')).tap({ x: 5, y: 5 });
  } catch (_) {}
  await element(by.id('runCommand')).tap();
  return waitForEvent('commandResult', timeout, (result) => result.id === id);
}

/** Like runAppCommand, but throws when the SDK call fails. */
async function runAppCommandOk(op, args = {}, timeout = 20000) {
  const result = await runAppCommand(op, args, timeout);
  if (!result.ok) {
    throw new Error(`App command ${op} failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/**
 * Restores the app's publisher/subscriber properties changed by a test. Call it in afterEach
 * before session.cleanup(): the command input only exists while the app is connected.
 */
async function resetAppProperties() {
  await withTimeout(runAppCommand('resetProperties', {}, 10000).catch(() => {}), 15000, 'resetProperties');
}

module.exports = { runAppCommand, runAppCommandOk, resetAppProperties };
