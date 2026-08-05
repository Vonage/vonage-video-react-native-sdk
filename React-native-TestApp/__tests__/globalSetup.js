'use strict';

/**
 * Jest globalSetup script for E2E tests.
 *
 * Runs OUTSIDE of Jest's module sandbox as a plain Node process.
 * This avoids ESM compatibility issues (uuid v10 in opentok) that
 * prevent require('opentok') inside the Jest/Detox environment.
 *
 * Flow:
 *   1. Validates env vars
 *   2. Uses the opentok SDK directly (safe here — outside Jest sandbox)
 *   3. Creates sessions and generates tokens
 *   4. Writes .e2e-credentials.json for test consumption
 *
 * IMPORTANT: This does NOT write to sdk-config.json.
 * sdk-config.json is reserved for manual testing credentials only.
 */

const path = require('path');
const fs = require('fs');
// Resolve opentok from TestApp's node_modules (it's a devDep of TestApp, not root)
const OpenTok = require(require.resolve('opentok', { paths: [path.join(__dirname, '..')] }));

const CREDENTIALS_PATH = path.join(__dirname, '.e2e-credentials.json');

module.exports = async function globalSetup() {
  // Environment variable resolution
  const apiKey = process.env.E2E_API_KEY || process.env.VONAGE_API_KEY;
  const apiSecret = process.env.E2E_API_SECRET || process.env.VONAGE_API_SECRET;
  const apiUrl = process.env.E2E_API_URL || process.env.API_URL || 'https://api.opentok.com';
  const jsSdkUrl = process.env.E2E_JS_SDK_URL || 'https://static.opentok.com/v2/js/opentok.min.js';

  if (!apiKey || !apiSecret) {
    throw new Error(
      'E2E tests require API credentials.\n' +
      'Set E2E_API_KEY and E2E_API_SECRET (or VONAGE_API_KEY and VONAGE_API_SECRET) environment variables.'
    );
  }

  console.log('[globalSetup] Generating E2E credentials...');
  console.log('[globalSetup] apiUrl:', apiUrl);
  console.log('[globalSetup] jsSdkUrl:', jsSdkUrl);

  const ot = new OpenTok(apiKey, apiSecret, { apiUrl });

  // Promisified session creation
  const createSession = (options) =>
    new Promise((resolve, reject) => {
      ot.createSession(options, (error, session) => {
        if (error) reject(error);
        else resolve(session);
      });
    });

  // Generate token helper
  const generateToken = (sessionId, { role, data }) =>
    ot.generateToken(sessionId, {
      role,
      expireTime: Math.floor(Date.now() / 1000) + 7200,
      data,
    });

  // Create routed session
  const routedSession = await createSession({ mediaMode: 'routed' });
  const routedSessionId = routedSession.sessionId;

  const tokenApp = generateToken(routedSessionId, { role: 'moderator', data: 'participant=app' });
  const tokenBot = generateToken(routedSessionId, { role: 'publisher', data: 'participant=bot1' });
  const tokenBot2 = generateToken(routedSessionId, { role: 'publisher', data: 'participant=bot2' });
  const tokenSubscriber = generateToken(routedSessionId, { role: 'subscriber', data: 'participant=subscriber' });

  // Create relayed session
  const relayedSession = await createSession({ mediaMode: 'relayed' });
  const relayedSessionId = relayedSession.sessionId;

  const relayedTokenApp = generateToken(relayedSessionId, { role: 'moderator', data: 'participant=app' });
  const relayedTokenBot = generateToken(relayedSessionId, { role: 'publisher', data: 'participant=bot1' });

  // Write credentials to temp file (NOT to sdk-config.json)
  const credentials = {
    routed: {
      apiKey,
      apiSecret,
      apiUrl,
      jsSdkUrl,
      sessionId: routedSessionId,
      tokenApp,
      tokenBot,
      tokenBot2,
      tokenSubscriber,
      mediaMode: 'routed',
    },
    relayed: {
      apiKey,
      apiSecret,
      apiUrl,
      jsSdkUrl,
      sessionId: relayedSessionId,
      tokenApp: relayedTokenApp,
      tokenBot: relayedTokenBot,
      mediaMode: 'relayed',
    },
  };

  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2));
  console.log('[globalSetup] Credentials written to', CREDENTIALS_PATH);
  console.log('[globalSetup] routedSession:', routedSessionId);
  console.log('[globalSetup] relayedSession:', relayedSessionId);
};
