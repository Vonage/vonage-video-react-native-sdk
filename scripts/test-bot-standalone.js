'use strict';

/**
 * Standalone test for the VonageBot.
 * Run with:
 *   E2E_API_KEY=xxx E2E_API_SECRET=xxx E2E_API_URL=https://api.dev.opentok.com node scripts/test-bot-standalone.js
 *
 * This isolates the bot from Detox to debug connectivity issues.
 */

const path = require('path');
const { VonageBot } = require(path.join(__dirname, '../React-native-TestApp/__tests__/helpers/VonageBot'));

const API_KEY = process.env.E2E_API_KEY;
const API_SECRET = process.env.E2E_API_SECRET;
const API_URL = process.env.E2E_API_URL || 'https://api.dev.opentok.com';

if (!API_KEY || !API_SECRET) {
  console.error('Set E2E_API_KEY and E2E_API_SECRET env vars');
  process.exit(1);
}

async function main() {
  const OpenTok = require('opentok');
  const ot = new OpenTok(API_KEY, API_SECRET, API_URL);

  // Step 1: Create session
  console.log('1. Creating session...');
  const session = await new Promise((resolve, reject) => {
    ot.createSession({ mediaMode: 'routed' }, (err, s) => {
      if (err) return reject(err);
      resolve(s);
    });
  });
  console.log('   sessionId:', session.sessionId);

  // Step 2: Generate token (T1== format — compatible with JS SDK on all envs)
  console.log('2. Generating token...');
  const { generateT1Token } = require(path.join(__dirname, '../React-native-TestApp/__tests__/helpers/credentials'));
  const token = generateT1Token(API_KEY, API_SECRET, session.sessionId, { role: 'publisher' });
  console.log('   token starts with:', token.substring(0, 10));
  console.log('   token format:', token.startsWith('T1==') ? 'T1== (legacy)' : token.startsWith('eyJ') ? 'JWT' : 'unknown');

  // Step 3: Launch bot
  console.log('3. Launching Chromium...');
  const bot = new VonageBot({ timeout: 30000 });
  await bot.launch();
  console.log('   Chromium launched.');

  // Step 4: Bot joins session
  console.log('4. Bot joining session (apiUrl:', API_URL, ')...');
  try {
    await bot.joinSession(API_KEY, session.sessionId, token, { apiUrl: API_URL });
    console.log('   Bot connected and publishing!');
    const state = await bot.getState();
    console.log('   Bot state:', JSON.stringify(state));
  } catch (e) {
    const state = await bot.getState();
    console.log('   Bot FAILED:', e.message);
    console.log('   Bot state:', JSON.stringify(state));
  }

  // Cleanup
  await bot.close();
  console.log('5. Done.');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
