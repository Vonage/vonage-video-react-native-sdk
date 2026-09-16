const path = require('path');
const e2eAppRoot = path.join(__dirname, 'e2e/E2ETestingApp');
const iosAppRoot = path.join(e2eAppRoot, 'ios');
const androidAppRoot = path.join(e2eAppRoot, 'android');

// The iOS simulator destination is resolved at run time. Runner images ship
// several iOS runtimes (e.g. 18.x and 26.x), so `name=iPhone 16` + implicit
// `OS:latest` can fail to match when iPhone 16 only exists on an older
// runtime. CI resolves a concrete simulator UDID and exports it; locally we
// fall back to matching by name.
const iosSimulatorUdid = process.env.DETOX_IOS_UDID;
const iosDestination = iosSimulatorUdid
  ? `platform=iOS Simulator,id=${iosSimulatorUdid}`
  : 'platform=iOS Simulator,name=iPhone 16';

// Detox device selector: prefer an explicit UDID when provided, else by type.
const iosSimulatorDevice = iosSimulatorUdid
  ? { id: iosSimulatorUdid }
  : { type: 'iPhone 16' };

module.exports = {
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: `${iosAppRoot}/build/Build/Products/Debug-iphonesimulator/E2ETestingApp.app`,
      build: `xcodebuild -workspace ${iosAppRoot}/E2ETestingApp.xcworkspace -scheme E2ETestingApp -configuration Debug -derivedDataPath ${iosAppRoot}/build -sdk iphonesimulator -destination '${iosDestination}' ARCHS=arm64 ONLY_ACTIVE_ARCH=YES SWIFT_ENABLE_EXPLICIT_MODULES=NO`,
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
      device: iosSimulatorDevice,
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: process.env.DETOX_AVD_NAME || 'Pixel_8_API_36',
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
