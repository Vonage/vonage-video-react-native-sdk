const path = require('path');

const sdkRoot = path.resolve(__dirname, '../..');

module.exports = {
  dependencies: {
    '@vonage/client-sdk-video-react-native': {
      root: sdkRoot,
      platforms: {
        android: {
          sourceDir: path.join(sdkRoot, 'android'),
        },
      },
    },
  },
};
