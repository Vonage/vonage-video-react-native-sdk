'use strict';

/**
 * Credential reader for E2E tests.
 *
 * Reads credentials from sdk-config.json. Credentials should be
 * pre-generated before running tests using:
 *   node scripts/generate-e2e-credentials.js
 *
 * The generation logic (opentok SDK) lives in scripts/, NOT here,
 * because the opentok package uses ESM internally and is incompatible
 * with the Detox/Jest test environment.
 */

const fs = require('fs');
const path = require('path');

const SDK_CONFIG_PATH = path.join(__dirname, '../../sdk-config.json');

/**
 * Reads the sdk-config.json file and returns the parsed config object.
 * Throws with generation instructions if the file is missing.
 *
 * @returns {object} Parsed config object
 */
function readConfig() {
  if (!fs.existsSync(SDK_CONFIG_PATH)) {
    throw new Error(
      `sdk-config.json not found at ${SDK_CONFIG_PATH}.\n` +
        'Generate credentials first:\n' +
        '  E2E_API_KEY=xxx E2E_API_SECRET=xxx node scripts/generate-e2e-credentials.js'
    );
  }
  return JSON.parse(fs.readFileSync(SDK_CONFIG_PATH, 'utf8'));
}

/**
 * Reads routed session credentials from sdk-config.json.
 *
 * @returns {Promise<{apiKey: string, apiUrl: string, sessionId: string, tokenApp: string, tokenBot: string|null, tokenBot2: string|null, tokenSubscriber: string|null, mediaMode: string}>}
 */
async function getCredentials() {
  const config = readConfig();
  const video = config?.credentials?.video;

  if (!video?.apiKey || !video?.sessionId || !video?.token) {
    throw new Error(
      'sdk-config.json missing credentials (apiKey, sessionId, token).\n' +
        'Generate credentials first:\n' +
        '  E2E_API_KEY=xxx E2E_API_SECRET=xxx node scripts/generate-e2e-credentials.js'
    );
  }

  return {
    apiKey: video.apiKey,
    apiUrl: video.apiUrl || '',
    sessionId: video.sessionId,
    tokenApp: video.token,
    tokenBot: video.tokenBot || null,
    tokenBot2: video.tokenBot2 || null,
    tokenSubscriber: video.tokenSubscriber || null,
    mediaMode: video.mediaMode || 'routed',
  };
}

/**
 * Reads relayed (P2P) session credentials from sdk-config.json.
 * The relayed block lives at credentials.video.relayed; apiKey and apiUrl
 * are shared with the parent credentials.video object.
 *
 * @returns {Promise<{apiKey: string, apiUrl: string, sessionId: string, tokenApp: string, tokenBot: string|null}>}
 */
async function getRelayedCredentials() {
  const config = readConfig();
  const video = config?.credentials?.video;
  const relayed = video?.relayed;

  if (!relayed?.sessionId || !relayed?.token || !relayed?.tokenBot) {
    throw new Error(
      'Relayed credentials not found in sdk-config.json.\n' +
        'Generate them first:\n' +
        '  E2E_API_KEY=xxx E2E_API_SECRET=xxx node scripts/generate-e2e-credentials.js'
    );
  }

  return {
    apiKey: video.apiKey,
    apiUrl: video.apiUrl || '',
    sessionId: relayed.sessionId,
    tokenApp: relayed.token,
    tokenBot: relayed.tokenBot,
  };
}

module.exports = { getCredentials, getRelayedCredentials };
