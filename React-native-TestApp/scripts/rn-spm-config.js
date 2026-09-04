#!/usr/bin/env node
'use strict';

/**
 * rn-spm-config.js — React Native SPM autolinking config command.
 *
 * WHY THIS EXISTS: `npx react-native spm` generates its autolinking config by
 * running `@react-native-community/cli config` and requires
 * `project.ios.sourceDir`. That CLI detects the iOS project ONLY by locating a
 * Podfile (cli-config-apple: "The only file that we can assume to exist on disk
 * is `Podfile`"). This app is SPM-only and ships no Podfile, so the stock CLI
 * returns `project.ios = null` and `spm` fails with:
 *   "CLI config did not provide project.ios.sourceDir".
 *
 * This wrapper runs the real CLI config and, when `project.ios` is missing,
 * fills it in from the on-disk `.xcodeproj` — no CocoaPods involved. It is wired
 * in via `--config-command` (or RCT_SPM_AUTOLINKING_CONFIG_COMMAND). Everything
 * else in the CLI config (dependencies, android, root) is passed through
 * untouched.
 *
 * Usage:
 *   node scripts/rn-spm-config.js            # from the app root (React-native-TestApp)
 *   npx react-native spm --yes --config-command '["node","scripts/rn-spm-config.js"]'
 */

const {execFileSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const appRoot = process.cwd();
const iosDir = path.join(appRoot, 'ios');

// Run the stock community-CLI config from the app root.
const cliBin = require.resolve('@react-native-community/cli/build/bin.js', {
  paths: [appRoot],
});
const raw = execFileSync(process.execPath, [cliBin, 'config'], {
  cwd: appRoot,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

const config = JSON.parse(raw);
config.project = config.project || {};

// Fill project.ios when the stock CLI could not (no Podfile). Detect the
// .xcodeproj on disk; everything under ios/ is the iOS source dir.
if (!config.project.ios) {
  const xcodeproj = fs
    .readdirSync(iosDir)
    .find((e) => e.endsWith('.xcodeproj'));

  if (!xcodeproj) {
    throw new Error(
      `rn-spm-config: no .xcodeproj found in ${iosDir}; cannot synthesize project.ios`,
    );
  }

  config.project.ios = {
    sourceDir: iosDir,
    xcodeProject: {
      name: xcodeproj,
      path: '.',
      isWorkspace: false,
    },
    assets: [],
  };
}

process.stdout.write(JSON.stringify(config));
