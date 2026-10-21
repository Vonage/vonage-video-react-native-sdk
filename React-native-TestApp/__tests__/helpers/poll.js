'use strict';

async function pollUntil(condition, { timeout = 10000, interval = 250, label = 'condition' } = {}) {
  const start = Date.now();
  for (;;) {
    if (await condition()) return;
    if (Date.now() - start > timeout) {
      throw new Error(`Timed out after ${timeout}ms waiting for ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[timeout] ${label} did not finish within ${ms}ms, continuing.`);
      resolve();
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

module.exports = { pollUntil, withTimeout };
