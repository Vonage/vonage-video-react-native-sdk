'use strict';

const fs = require('fs');
const OpenTok = require('opentok');

const apiUrl = process.env.API_URL;
const apiKey = process.env.VONAGE_API_KEY;
const apiSecret = process.env.VONAGE_API_SECRET;
const githubEnvFile = process.env.GITHUB_ENV;

const missingParams = [
  ['VONAGE_API_KEY', apiKey],
  ['VONAGE_API_SECRET', apiSecret],
  ['API_URL', apiUrl],
].filter(([, value]) => !value);

if (missingParams.length > 0) {
  throw new Error(
    `Missing required GitHub secrets: ${missingParams
      .map(([name]) => name)
      .join(', ')}.`
  );
}

if (!githubEnvFile) {
  throw new Error('GITHUB_ENV is not available.');
}

const opentok = new OpenTok(apiKey, apiSecret, apiUrl);

const createSession = (options) =>
  new Promise((resolve, reject) => {
    opentok.createSession(options, (error, session) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(session);
    });
  });

(async () => {
  const session = await createSession({ mediaMode: 'routed' });
  const token = opentok.generateToken(session.sessionId, {
    role: 'publisher',
    expireTime: Math.floor(Date.now() / 1000) + 120 * 60,
    data: `environmentUrl=${apiUrl}`,
  });

  fs.appendFileSync(
    githubEnvFile,
    [
      `TESTING_APPLICATION_ID=${apiKey}`,
      `TESTING_SESSION_ID=${session.sessionId}`,
      `TESTING_TOKEN=${token}`,
    ].join('\n') + '\n'
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
