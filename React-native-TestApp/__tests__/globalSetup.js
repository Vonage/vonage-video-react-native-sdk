'use strict';

/**
 * Jest globalSetup for the E2E tests. It runs as a plain Node process, outside Jest's module
 * sandbox, because the opentok package cannot be loaded inside it. Creates the sessions and tokens
 * and writes .e2e-credentials.json (sdk-config.json is reserved for manual testing).
 */

const path = require('path');
const fs = require('fs');
// Resolve opentok from TestApp's node_modules (it's a devDep of TestApp, not root)
const OpenTok = require(require.resolve('opentok', { paths: [path.join(__dirname, '..')] }));

const CREDENTIALS_PATH = path.join(__dirname, '.e2e-credentials.json');

module.exports = async function globalSetup() {
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

  const createSession = (options) =>
    new Promise((resolve, reject) => {
      ot.createSession(options, (error, session) => {
        if (error) reject(error);
        else resolve(session);
      });
    });

  const generateToken = (sessionId, { role, data }) =>
    ot.generateToken(sessionId, {
      role,
      expireTime: Math.floor(Date.now() / 1000) + 7200,
      data,
    });

  // Number of publisher tokens generated per session. Tests take as many bots
  // as they need from this pool. Override with E2E_BOT_POOL_SIZE.
  const botPoolSize = parseInt(process.env.E2E_BOT_POOL_SIZE || '4', 10);

  const generateBotTokens = (sessionId) =>
    Array.from({ length: botPoolSize }, (_, i) =>
      generateToken(sessionId, { role: 'publisher', data: `participant=bot${i + 1}` })
    );

  const routedSession = await createSession({ mediaMode: 'routed' });
  const routedSessionId = routedSession.sessionId;
  const tokenApp = generateToken(routedSessionId, { role: 'moderator', data: 'participant=app' });

  // Dedicated session for moderation specs: force-mute state is sticky per
  // session, so it must not leak into other specs.
  const moderationSession = await createSession({ mediaMode: 'routed' });
  const moderationSessionId = moderationSession.sessionId;
  const moderationTokenApp = generateToken(moderationSessionId, { role: 'moderator', data: 'participant=app' });
  const moderatorBotToken = generateToken(moderationSessionId, { role: 'moderator', data: 'participant=moderator-bot' });

  const relayedSession = await createSession({ mediaMode: 'relayed' });
  const relayedSessionId = relayedSession.sessionId;
  const relayedTokenApp = generateToken(relayedSessionId, { role: 'moderator', data: 'participant=app' });

  const credentials = {
    routed: {
      apiKey,
      apiSecret,
      apiUrl,
      jsSdkUrl,
      sessionId: routedSessionId,
      tokenApp,
      botTokens: generateBotTokens(routedSessionId),
      mediaMode: 'routed',
    },
    moderation: {
      apiKey,
      apiSecret,
      apiUrl,
      jsSdkUrl,
      sessionId: moderationSessionId,
      tokenApp: moderationTokenApp,
      botTokens: generateBotTokens(moderationSessionId),
      moderatorBotToken,
      mediaMode: 'routed',
    },
    relayed: {
      apiKey,
      apiSecret,
      apiUrl,
      jsSdkUrl,
      sessionId: relayedSessionId,
      tokenApp: relayedTokenApp,
      botTokens: generateBotTokens(relayedSessionId),
      mediaMode: 'relayed',
    },
  };

  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2));
  console.log('[globalSetup] Credentials written to', CREDENTIALS_PATH);
  console.log('[globalSetup] routedSession:', routedSessionId);
  console.log('[globalSetup] moderationSession:', moderationSessionId);
  console.log('[globalSetup] relayedSession:', relayedSessionId);
  console.log('[globalSetup] bot tokens per session:', botPoolSize);
};
