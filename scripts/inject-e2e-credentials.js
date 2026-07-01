'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../React-native-TestApp/sdk-config.json');
const applicationId = process.env.TESTING_APPLICATION_ID;
const sessionId = process.env.TESTING_SESSION_ID;
const token = process.env.TESTING_TOKEN;

if (!applicationId || !sessionId || !token) {
  throw new Error(
    'Missing one or more generated E2E values: TESTING_APPLICATION_ID, TESTING_SESSION_ID, TESTING_TOKEN.'
  );
}

const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
config.credentials.video.apiKey = applicationId;
config.credentials.video.sessionId = sessionId;
config.credentials.video.token = token;
fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n');
