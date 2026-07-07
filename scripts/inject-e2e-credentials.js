'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../React-native-TestApp/sdk-config.json');
const applicationId = process.env.TESTING_APPLICATION_ID;
const sessionId = process.env.TESTING_SESSION_ID;
const token = process.env.TESTING_TOKEN;
const tokenBot = process.env.TESTING_TOKEN_BOT;

if (!applicationId || !sessionId || !token) {
  throw new Error(
    'Missing one or more generated E2E values: TESTING_APPLICATION_ID, TESTING_SESSION_ID, TESTING_TOKEN.'
  );
}

if (!tokenBot) {
  console.warn('TESTING_TOKEN_BOT not set — bot tests will not have credentials.');
}

const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));

if (!config?.credentials?.video) {
  throw new Error(`Invalid sdk-config.json at ${filePath}: missing credentials.video`);
}

config.credentials.video.apiKey = applicationId;
config.credentials.video.sessionId = sessionId;
config.credentials.video.token = token;
config.credentials.video.apiUrl = process.env.API_URL || '';
if (tokenBot) {
  config.credentials.video.tokenBot = tokenBot;
}
fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n');
