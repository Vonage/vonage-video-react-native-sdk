'use strict';
const { disableMuteAll } = require('./openTokRest');

async function openModerationTab() {
  await element(by.id('tabModeration')).tap();
  await waitFor(element(by.id('muteAll'))).toBeVisible().withTimeout(5000);
}

async function resetMuteState(session) {
  const { apiKey, apiSecret, apiUrl, sessionId } = session.credentials;
  await disableMuteAll(apiKey, apiSecret, apiUrl, sessionId);
}

module.exports = { openModerationTab, resetMuteState };
