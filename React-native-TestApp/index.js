/**
 * @format
 */

import {AppRegistry, LogBox, NativeModules} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

if (__DEV__) {
  // Suppress LogBox overlay (warnings/errors pill at bottom) — blocks touch events in e2e tests.
  LogBox.ignoreAllLogs(true);

  // Disable the floating "Open React Native DevTools" button introduced in RN 0.73+.
  // It renders at the bottom of the screen in debug builds and intercepts taps in e2e tests.
  // DevToolsSettingsManager is the native module that controls this overlay.
  NativeModules.DevToolsSettingsManager?.setIsDevToolsEnabled?.(false);
}

AppRegistry.registerComponent(appName, () => App);
