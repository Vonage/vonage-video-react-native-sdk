'use strict';

/**
 * Runs the test only when `condition` holds; otherwise registers it as skipped. The test keeps its
 * exact name, because the QA regression catalog matches results by Jest full name. The reason is
 * printed when the spec loads and kept next to the test in the source.
 */
function itIf(condition, reason) {
  return (name, fn, timeout) => {
    if (condition) return it(name, fn, timeout);
    console.warn(`[skip] ${name}: ${reason}`);
    return it.skip(name, fn, timeout);
  };
}

module.exports = { itIf };
