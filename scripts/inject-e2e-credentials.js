'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../e2e/E2ETestingApp/App.tsx');
const applicationId = process.env.TESTING_APPLICATION_ID;
const sessionId = process.env.TESTING_SESSION_ID;
const token = process.env.TESTING_TOKEN;

if (!applicationId || !sessionId || !token) {
  throw new Error(
    'Missing one or more generated E2E values: TESTING_APPLICATION_ID, TESTING_SESSION_ID, TESTING_TOKEN.'
  );
}

let source = fs.readFileSync(filePath, 'utf8');
source = source.replace(
  /applicationId:\s*'[^']*'/,
  `applicationId: ${JSON.stringify(applicationId)}`
);
source = source.replace(
  /sessionId:\s*'[^']*'/,
  `sessionId: ${JSON.stringify(sessionId)}`
);
source = source.replace(/token:\s*'[^']*'/, `token: ${JSON.stringify(token)}`);
fs.writeFileSync(filePath, source);
