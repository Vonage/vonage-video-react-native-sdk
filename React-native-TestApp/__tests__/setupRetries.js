// At most one retry per test, for the whole suite. Passed-after-retry tests show up in the CI job summary.
jest.retryTimes(1, { logErrorsBeforeRetry: true });
