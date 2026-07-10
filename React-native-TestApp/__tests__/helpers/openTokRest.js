'use strict';

const https = require('https');
const crypto = require('crypto');

/**
 * Minimal OpenTok REST API client for moderation tests.
 * Uses the REST API directly (no opentok npm dependency).
 *
 * Supports:
 *   - forceDisconnect(sessionId, connectionId)
 */

function generateJwt(apiKey, apiSecret) {
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'HS256' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iss: apiKey, ist: 'project', iat: now, exp: now + 300 })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function httpRequest(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname,
      method,
      headers: { ...headers },
    };
    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Force-disconnects a connection from a session via REST API.
 */
async function forceDisconnect(apiKey, apiSecret, apiUrl, sessionId, connectionId) {
  const jwt = generateJwt(apiKey, apiSecret);
  const url = `${apiUrl}/v2/project/${apiKey}/session/${sessionId}/connection/${connectionId}`;
  const res = await httpRequest('DELETE', url, {
    'X-OPENTOK-AUTH': jwt,
    'Content-Type': 'application/json',
  });
  if (res.status !== 204 && res.status !== 200) {
    throw new Error(`forceDisconnect failed: HTTP ${res.status} — ${res.body}`);
  }
}

/**
 * Force-mutes a specific stream in a session via REST API.
 */
async function forceMuteStream(apiKey, apiSecret, apiUrl, sessionId, streamId) {
  const jwt = generateJwt(apiKey, apiSecret);
  const url = `${apiUrl}/v2/project/${apiKey}/session/${sessionId}/stream/${streamId}/mute`;
  const res = await httpRequest('POST', url, {
    'X-OPENTOK-AUTH': jwt,
    'Content-Type': 'application/json',
  });
  if (res.status !== 200) {
    throw new Error(`forceMuteStream failed: HTTP ${res.status} — ${res.body}`);
  }
}

module.exports = { forceDisconnect, forceMuteStream };
