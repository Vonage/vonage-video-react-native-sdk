'use strict';

/**
 * Generates fresh E2E credentials and writes them to sdk-config.json.
 * Run before launching e2e tests locally:
 *
 *   E2E_API_KEY=xxx E2E_API_SECRET=xxx node scripts/generate-e2e-credentials-local.js
 *
 * Options:
 *   --media-mode=routed|relayed  Override the primary session media mode (default: routed)
 *   MEDIA_MODE env var           Fallback if --media-mode CLI arg not provided
 *
 * This uses the official opentok Node.js SDK to create a routed session
 * (or relayed if overridden), a relayed session (always), and generate
 * T1== tokens compatible with all environments.
 */

const fs = require('fs');
const path = require('path');
const OpenTok = require('opentok');

const API_KEY = process.env.E2E_API_KEY;
const API_SECRET = process.env.E2E_API_SECRET;
const API_URL = process.env.E2E_API_URL || 'https://api.opentok.com';
const JS_SDK_URL = process.env.E2E_JS_SDK_URL || 'https://static.opentok.com/v2/js/opentok.min.js';
const CONFIG_PATH = path.join(__dirname, '../React-native-TestApp/sdk-config.json');

const VALID_MEDIA_MODES = ['routed', 'relayed'];

if (!API_KEY || !API_SECRET) {
  console.error('Usage: E2E_API_KEY=xxx E2E_API_SECRET=xxx node scripts/generate-e2e-credentials-local.js');
  process.exit(1);
}

/**
 * Parse --media-mode CLI arg. CLI takes precedence over MEDIA_MODE env var.
 * Defaults to 'routed' if neither is provided.
 */
function getMediaMode() {
  // Check CLI args for --media-mode=value
  const cliArg = process.argv.find((arg) => arg.startsWith('--media-mode='));
  if (cliArg) {
    return cliArg.split('=')[1];
  }

  // Fallback to MEDIA_MODE env var
  if (process.env.MEDIA_MODE) {
    return process.env.MEDIA_MODE;
  }

  // Default
  return 'routed';
}

const mediaMode = getMediaMode();

if (!VALID_MEDIA_MODES.includes(mediaMode)) {
  console.error(`Error: Invalid media mode "${mediaMode}". Valid values are: ${VALID_MEDIA_MODES.join(', ')}`);
  process.exit(1);
}

const ot = new OpenTok(API_KEY, API_SECRET, API_URL);

// Create the primary session with the configured media mode
ot.createSession({ mediaMode }, (err, session) => {
  if (err) {
    console.error('Failed to create primary session:', err);
    process.exit(1);
  }

  const sessionId = session.sessionId;
  const tokenApp = ot.generateToken(sessionId, {
    role: 'moderator',
    expireTime: Math.floor(Date.now() / 1000) + 7200,
    data: 'participant=app',
  });
  const tokenBot = ot.generateToken(sessionId, {
    role: 'publisher',
    expireTime: Math.floor(Date.now() / 1000) + 7200,
    data: 'participant=bot1',
  });
  const tokenBot2 = ot.generateToken(sessionId, {
    role: 'publisher',
    expireTime: Math.floor(Date.now() / 1000) + 7200,
    data: 'participant=bot2',
  });
  const tokenSubscriber = ot.generateToken(sessionId, {
    role: 'subscriber',
    expireTime: Math.floor(Date.now() / 1000) + 7200,
    data: 'participant=subscriber',
  });

  // Create a relayed session (always generated regardless of --media-mode flag)
  ot.createSession({ mediaMode: 'relayed' }, (relayedErr, relayedSession) => {
    if (relayedErr) {
      console.error('Failed to create relayed session:', relayedErr);
      process.exit(1);
    }

    const relayedSessionId = relayedSession.sessionId;
    const relayedTokenApp = ot.generateToken(relayedSessionId, {
      role: 'moderator',
      expireTime: Math.floor(Date.now() / 1000) + 7200,
      data: 'participant=app',
    });
    const relayedTokenBot = ot.generateToken(relayedSessionId, {
      role: 'publisher',
      expireTime: Math.floor(Date.now() / 1000) + 7200,
      data: 'participant=bot1',
    });

    // Update sdk-config.json
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    config.credentials.video.apiKey = API_KEY;
    config.credentials.video.sessionId = sessionId;
    config.credentials.video.token = tokenApp;
    config.credentials.video.tokenBot = tokenBot;
    config.credentials.video.tokenBot2 = tokenBot2;
    config.credentials.video.tokenSubscriber = tokenSubscriber;
    config.credentials.video.apiUrl = API_URL;
    config.credentials.video.mediaMode = mediaMode;
    // Store JS SDK URL for bot usage (defaults to production CDN)
    config.credentials.video.jsSdkUrl = JS_SDK_URL;
    config.credentials.video.relayed = {
      sessionId: relayedSessionId,
      token: relayedTokenApp,
      tokenBot: relayedTokenBot,
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');

    console.log('Credentials written to sdk-config.json');
    console.log('  primarySession:', sessionId);
    console.log('  mediaMode:', mediaMode);
    console.log('  relayedSession:', relayedSessionId);
    console.log('  apiUrl:', API_URL);
    console.log('  jsSdkUrl:', JS_SDK_URL);
    console.log('  tokens: app + bot1 + bot2 + subscriber (primary)');
    console.log('  tokens: app + bot1 (relayed)');
  });
});
