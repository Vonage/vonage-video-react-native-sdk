const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */

// Get the SDK root directory (parent of this test app)
const sdkRoot = path.resolve(__dirname, '..');

const config = {
  watchFolders: [
    // Watch the SDK directory for changes
    sdkRoot,
  ],
  resolver: {
    // Look for node_modules in both the test app and SDK root
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(sdkRoot, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
