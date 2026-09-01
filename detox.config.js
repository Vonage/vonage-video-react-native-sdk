const path = require('path');
const testAppRoot = path.join(__dirname, 'React-native-TestApp');
const iosAppRoot = path.join(testAppRoot, 'ios');
const androidAppRoot = path.join(testAppRoot, 'android');

module.exports = {
  testRunner: {
    args: {
      '$0': 'jest',
      config: 'React-native-TestApp/__tests__/jest.e2e.config.js'
    },
    jest: {
      setupTimeout: 120000
    }
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: `${iosAppRoot}/build/Build/Products/Debug-iphonesimulator/ReactNativeTesApp.app`,
      build: `xcodebuild -workspace ${iosAppRoot}/ReactNativeTesApp.xcworkspace -scheme ReactNativeTesApp -configuration Debug -derivedDataPath ${iosAppRoot}/build -sdk iphonesimulator ARCHS=arm64 ONLY_ACTIVE_ARCH=YES SWIFT_ENABLE_EXPLICIT_MODULES=NO`,
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: `${iosAppRoot}/build/Build/Products/Release-iphonesimulator/ReactNativeTesApp.app`,
      build: `xcodebuild -workspace ${iosAppRoot}/ReactNativeTesApp.xcworkspace -scheme ReactNativeTesApp -configuration Release -derivedDataPath ${iosAppRoot}/build -sdk iphonesimulator ARCHS=arm64 ONLY_ACTIVE_ARCH=YES SWIFT_ENABLE_EXPLICIT_MODULES=NO`,
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
        type: process.env.DETOX_DEVICE_NAME || 'iPhone 15',
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
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
  },
};
