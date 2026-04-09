module.exports = {
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: '/Users/iperunovic/Code/vonage-video-react-native-sdk/e2e/E2ETestingApp/ios/build/Build/Products/Debug-iphonesimulator/E2ETestingApp.app',
      build: "xcodebuild -workspace /Users/iperunovic/Code/vonage-video-react-native-sdk/e2e/E2ETestingApp/ios/E2ETestingApp.xcworkspace -scheme E2ETestingApp -configuration Debug -derivedDataPath /Users/iperunovic/Code/vonage-video-react-native-sdk/e2e/E2ETestingApp/ios/build -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17' ARCHS=arm64 ONLY_ACTIVE_ARCH=YES SWIFT_ENABLE_EXPLICIT_MODULES=NO",
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
