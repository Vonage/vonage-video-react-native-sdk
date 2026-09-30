'use strict';

beforeAll(async () => {
  if (device.getPlatform() === 'android') {
    // ADB reconnects can clear reverse mappings during a run. Restore Metro
    // before each suite launches the app and requests its JavaScript bundle.
    await device.reverseTcpPort(8081);
  }
});
