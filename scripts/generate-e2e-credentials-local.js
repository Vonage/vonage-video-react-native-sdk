'use strict';

/**
 * Generates fresh E2E credentials and writes them to sdk-config.json.
 * Run before launching e2e tests locally:
 *
 *   E2E_API_KEY=xxx E2E_API_SECRET=xxx node scripts/generate-e2e-credentials-local.js
 *
 * This uses the official opentok Node.js SDK to create a routed session
 * and generate T1== tokens compatible with all environments.
 */

const fs = require('fs');
const path = require('path');
const OpenTok = require('opentok');

const API_KEY = process.env.E2E_API_KEY;
const API_SECRET = process.env.E2E_API_SECRET;
const API_URL = process.env.E2E_API_URL || 'https://api.opentok.com';
const CONFIG_PATH = path.join(__dirname, '../React-native-TestApp/sdk-config.json');

if (!API_KEY || !API_SECRET) {
  console.error('Usage: E2E_API_KEY=xxx E2E_API_SECRET=xxx node scripts/generate-e2e-credentials-local.js');
  process.exit(1);
}

const ot = new OpenTok(API_KEY, API_SECRET, API_URL);

ot.createSession({ mediaMode: 'routed' }, (err, session) => {
  if (err) {
    console.error('Failed to create session:', err);
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

  // Update sdk-config.json
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  config.credentials.video.apiKey = API_KEY;
  config.credentials.video.sessionId = sessionId;
  config.credentials.video.token = tokenApp;
  config.credentials.video.tokenBot = tokenBot;
  config.credentials.video.tokenBot2 = tokenBot2;
  config.credentials.video.apiUrl = API_URL;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');

  console.log('Credentials written to sdk-config.json');
  console.log('  sessionId:', sessionId);
  console.log('  apiUrl:', API_URL);
  console.log('  tokens: app + bot1 + bot2');
});
