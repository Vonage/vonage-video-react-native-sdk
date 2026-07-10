/** @type {Detox.DetoxConfig} */
module.exports = {
  logger: {
    level: 'verbose',
    options: {
      showLoggerName: false,
      showPid: false,
      showLevel: true
    }
  },
  testRunner: {
    args: {
      '$0': 'jest',
      config: '__tests__/jest.e2e.config.js'
    },
    jest: {
      setupTimeout: 300000
    }
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/ReactNativeTesApp.app',
      build: 'xcodebuild -workspace ios/ReactNativeTesApp.xcworkspace -scheme ReactNativeTesApp -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build'
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/ReactNativeTesApp.app',
      build: 'xcodebuild -workspace ios/ReactNativeTesApp.xcworkspace -scheme ReactNativeTesApp -configuration Release -sdk iphonesimulator -derivedDataPath ios/build'
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug'
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      build: 'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release'
    }
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: process.env.DETOX_DEVICE_NAME || 'iPhone SE (3rd generation)'
      }
    },
    attached: {
      type: 'android.attached',
      device: {
        adbName: '.*' // any attached device
      }
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: process.env.DETOX_AVD_NAME || 'Pixel_8_Pro_API_33'
      }
    }
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug'
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release'
    },
    'ios.sim.release.two': {
      device: 'simulator',
      app: 'ios.release'
    },
    'android.att.debug': {
      device: 'attached',
      app: 'android.debug'
    },
    'android.att.release': {
      device: 'attached',
      app: 'android.release'
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug'
    },
    'android.emu.release': {
      device: 'emulator',
      app: 'android.release'
    }
  }
};
