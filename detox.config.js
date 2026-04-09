const path = require('path');
const appRoot = path.join(__dirname, 'e2e/E2ETestingApp/ios');

module.exports = {
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: `${appRoot}/build/Build/Products/Debug-iphonesimulator/E2ETestingApp.app`,
      build: `xcodebuild -workspace ${appRoot}/E2ETestingApp.xcworkspace -scheme E2ETestingApp -configuration Debug -derivedDataPath ${appRoot}/build -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17' ARCHS=arm64 ONLY_ACTIVE_ARCH=YES SWIFT_ENABLE_EXPLICIT_MODULES=NO`,
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 17',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
  },
};
