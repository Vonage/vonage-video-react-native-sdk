'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const IMAGE = path.join(__dirname, '../../assets/background.jpg');
const ANDROID_PACKAGE = 'com.reactnativetesapp';
const IOS_BUNDLE_ID = 'org.reactjs.native.example.ReactNativeTesApp';

/**
 * Copies the test app's background image to a local file the app can read and returns its path.
 * Background replacement needs a local image file; the bundled asset is served over HTTP by Metro
 * in debug builds. Call it after the app is installed (launchApp).
 */
function pushBackgroundImage() {
  if (device.getPlatform() === 'android') {
    const dir = `/sdcard/Android/data/${ANDROID_PACKAGE}/files`;
    const dest = `${dir}/e2e-background.jpg`;
    execFileSync('adb', ['-s', device.id, 'shell', 'mkdir', '-p', dir]);
    execFileSync('adb', ['-s', device.id, 'push', IMAGE, dest]);
    return dest;
  }
  const container = execFileSync('xcrun', ['simctl', 'get_app_container', device.id, IOS_BUNDLE_ID, 'data'])
    .toString()
    .trim();
  const dir = path.join(container, 'Documents');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, 'e2e-background.jpg');
  fs.copyFileSync(IMAGE, dest);
  return dest;
}

module.exports = { pushBackgroundImage };
