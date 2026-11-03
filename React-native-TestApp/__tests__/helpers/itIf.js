'use strict';

function itIf(condition, reason) {
  return (name, fn, timeout) =>
    condition ? it(name, fn, timeout) : it.skip(`${name} [skipped: ${reason}]`, fn, timeout);
}

module.exports = { itIf };
