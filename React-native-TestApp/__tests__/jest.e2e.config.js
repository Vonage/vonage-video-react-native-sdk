module.exports = {
  testTimeout: 300000,
  maxWorkers: 1,
  // Match both regular e2e suites and opt-in stress suites (*.stress.js).
  // Stress suites are heavy and meant to be run explicitly, so the default
  // full-run scripts (test:e2e:ios / test:e2e:android) exclude them by passing
  // `--testPathIgnorePatterns .stress.js`. The `:suite` scripts run them via
  // `--testPathPattern <name>`.
  testMatch: ["**/*.e2e.js", "**/*.stress.js"],
  testEnvironment: "detox/runners/jest/testEnvironment",
  verbose: true,
  forceExit: true,
  globalSetup: "./globalSetup.js"
};
