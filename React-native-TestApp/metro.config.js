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
    // Block React and React Native from SDK's node_modules to prevent duplicate instances
    blockList: [
      new RegExp(`${sdkRoot.replace(/[/\\]/g, '[/\\\\]')}/node_modules/react/.*`),
      new RegExp(`${sdkRoot.replace(/[/\\]/g, '[/\\\\]')}/node_modules/react-native/.*`),
    ],
    // Force React and React Native to be resolved from test app's node_modules only
    // This prevents multiple React instances which cause "Invalid hook call" errors
    extraNodeModules: {
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-native': path.resolve(__dirname, 'node_modules/react-native'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
