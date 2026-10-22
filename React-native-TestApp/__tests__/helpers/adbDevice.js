'use strict';

const { execFileSync } = require('child_process');

/**
 * Resolves the adb serial of the device/emulator Detox is currently driving.
 *
 * Detox's `device` object does not expose the adb serial in a stable,
 * cross-version way for Android, so this reads it the same way the existing
 * device-snapshot.sh script does: from `adb devices`. Override with
 * E2E_ADB_SERIAL when more than one device/emulator is attached.
 */
function resolveAndroidSerial() {
  if (process.env.E2E_ADB_SERIAL) {
    return process.env.E2E_ADB_SERIAL;
  }
  const output = execFileSync('adb', ['devices'], { encoding: 'utf8' });
  const serials = output
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.endsWith('\tdevice') || line.endsWith(' device'))
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean);

  if (serials.length === 0) {
    throw new Error('resolveAndroidSerial: no attached adb device found (adb devices returned none)');
  }
  if (serials.length > 1) {
    throw new Error(
      `resolveAndroidSerial: multiple adb devices attached (${serials.join(', ')}). ` +
        'Set E2E_ADB_SERIAL to disambiguate.'
    );
  }
  return serials[0];
}

/**
 * Toggles the device's wifi + mobile data via `svc`, to simulate a real
 * network loss without depending on any backend REST API (whose latency and
 * connection-registration timing are not controllable from the test).
 *
 * The OpenTok/Vonage Video Android SDK detects the dropped socket and fires
 * onDisconnected() on its own timeout, same as it would for a real network
 * outage — this is the involuntary-disconnect path the leak fix targets.
 */
function setNetworkEnabled(serial, enabled) {
  const state = enabled ? 'enable' : 'disable';
  execFileSync('adb', ['-s', serial, 'shell', 'svc', 'wifi', state], { encoding: 'utf8' });
  execFileSync('adb', ['-s', serial, 'shell', 'svc', 'data', state], { encoding: 'utf8' });
}

module.exports = { resolveAndroidSerial, setNetworkEnabled };
