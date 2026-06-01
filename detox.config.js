const path = require('path');
const e2eAppRoot = path.join(__dirname, 'e2e/E2ETestingApp');
const iosAppRoot = path.join(e2eAppRoot, 'ios');
const androidAppRoot = path.join(e2eAppRoot, 'android');

module.exports = {
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: `${iosAppRoot}/build/Build/Products/Debug-iphonesimulator/E2ETestingApp.app`,
      build: `xcodebuild -workspace ${iosAppRoot}/E2ETestingApp.xcworkspace -scheme E2ETestingApp -configuration Debug -derivedDataPath ${iosAppRoot}/build -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17' ARCHS=arm64 ONLY_ACTIVE_ARCH=YES SWIFT_ENABLE_EXPLICIT_MODULES=NO`,
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: `${androidAppRoot}/app/build/outputs/apk/debug/app-debug.apk`,
      testBinaryPath: `${androidAppRoot}/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk`,
      build: `cd ${androidAppRoot} && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug`,
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 17',
      },
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: process.env.DETOX_AVD_NAME || 'Pixel_8_API_35',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
  },
};
