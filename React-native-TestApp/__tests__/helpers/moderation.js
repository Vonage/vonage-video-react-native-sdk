'use strict';
const { pollUntil } = require('./poll');
const { disableMuteAll } = require('./openTokRest');

async function openModerationTab() {
  await element(by.id('tabModeration')).tap();
  await waitFor(element(by.id('muteAll'))).toBeVisible().withTimeout(5000);
}

async function waitForPublisherAudio(bot, expected, timeout = 15000) {
  await pollUntil(async () => (await bot.getPublisherState()).hasAudio === expected, {
    timeout,
    label: `bot published stream hasAudio=${expected}`,
  });
}

async function waitForBotDisconnected(bot, timeout = 15000) {
  await pollUntil(async () => !(await bot.getState()).connected, {
    timeout,
    label: 'bot to be disconnected',
  });
}

async function resetMuteState(session) {
  const { apiKey, apiSecret, apiUrl, sessionId } = session.credentials;
  await disableMuteAll(apiKey, apiSecret, apiUrl, sessionId);
}

module.exports = { openModerationTab, waitForPublisherAudio, waitForBotDisconnected, resetMuteState };
