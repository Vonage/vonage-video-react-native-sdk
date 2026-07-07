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
 * Reads credentials from sdk-config.json.
 *
 * @returns {Promise<{apiKey: string, apiUrl: string, sessionId: string, tokenApp: string, tokenBot: string|null}>}
 */
async function getCredentials() {
  if (!fs.existsSync(SDK_CONFIG_PATH)) {
    throw new Error(
      `sdk-config.json not found at ${SDK_CONFIG_PATH}.\n` +
        'Generate credentials first:\n' +
        '  E2E_API_KEY=xxx E2E_API_SECRET=xxx node scripts/generate-e2e-credentials-local.js'
    );
  }

  const config = JSON.parse(fs.readFileSync(SDK_CONFIG_PATH, 'utf8'));
  const video = config?.credentials?.video;

  if (!video?.apiKey || !video?.sessionId || !video?.token) {
    throw new Error(
      'sdk-config.json missing credentials (apiKey, sessionId, token).\n' +
        'Generate credentials first:\n' +
        '  E2E_API_KEY=xxx E2E_API_SECRET=xxx node scripts/generate-e2e-credentials-local.js'
    );
  }

  return {
    apiKey: video.apiKey,
    apiUrl: video.apiUrl || 'https://api.dev.opentok.com',
    sessionId: video.sessionId,
    tokenApp: video.token,
    tokenBot: video.tokenBot || null,
  };
}

module.exports = { getCredentials };
