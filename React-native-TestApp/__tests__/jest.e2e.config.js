module.exports = {
  testTimeout: 300000,
  maxWorkers: 1,
  testMatch: ["**/*.e2e.js"],
  testEnvironment: "detox/runners/jest/testEnvironment",
  verbose: true
};
