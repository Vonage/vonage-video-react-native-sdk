#!/usr/bin/env node
// Converts Detox/Jest JSON results into the ClientSDKTests unified payload and
// sends it as a repository_dispatch (event "ingest-results") to opentok/ClientSDKTests.
//
// Usage:
//   node scripts/dispatch-test-results.js --platform ios --version 2.36.0 \
//     artifacts/ios26/jest-results-ios.json artifacts/ios27/jest-results-ios.json
//   Add --dry-run to print the payload instead of sending it.
// Env: CLIENTSDKTESTS_DISPATCH_TOKEN (required unless --dry-run).
'use strict';
const fs = require('fs');
const zlib = require('zlib');

const REPO = 'opentok/ClientSDKTests';
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args.splice(i, 2)[1];
};
const platform = opt('platform');
const version = opt('version');
const dryRun = args.includes('--dry-run');
const files = args.filter((a) => a !== '--dry-run');

if (!['ios', 'android'].includes(platform)) throw new Error('--platform must be ios or android');
if (!/^\d+\.\d+\.\d+([-.][\w.]+)?$/.test(version || '')) throw new Error(`--version "${version}" is not a version`);
if (files.length === 0) throw new Error('Pass at least one jest-results JSON file');

// Jest assertion status -> ClientSDKTests status (pass | fail | skip).
const STATUS = { passed: 'pass', failed: 'fail', pending: 'skip', skipped: 'skip', todo: 'skip', disabled: 'skip' };
// Several runs of the same platform (iOS matrix legs): keep the worst result.
const RANK = { skip: 0, pass: 1, fail: 2 };

const merged = new Map();
for (const file of files) {
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const suite of report.testResults) {
    if (suite.assertionResults.length === 0) {
      console.warn(`::warning::Suite did not run in ${file}: ${suite.name}. Its tests stay not-executed.`);
    }
    for (const a of suite.assertionResults) {
      const status = STATUS[a.status];
      if (!status) throw new Error(`Unknown Jest status "${a.status}" for "${a.fullName}"`);
      const prev = merged.get(a.fullName);
      if (!prev || RANK[status] > RANK[prev]) merged.set(a.fullName, status);
    }
  }
}

const results = [...merged].map(([codename, status]) => ({ codename, status }));
const clientPayload = {
  product: 'react-native',
  platform,
  version,
  date: new Date().toISOString().slice(0, 10),
  author: `ci:react-native-${platform}`,
  count: results.length,
  results_gz: zlib.gzipSync(JSON.stringify(results)).toString('base64'),
};
const tally = results.reduce((t, r) => ((t[r.status] = (t[r.status] || 0) + 1), t), {});
console.log(`${platform} @ ${version}: ${results.length} tests`, tally);

if (dryRun) {
  fs.writeFileSync(`payload-${platform}.json`, JSON.stringify(clientPayload, null, 2));
  console.log(`Dry run: wrote payload-${platform}.json`);
  process.exit(0);
}

const token = process.env.CLIENTSDKTESTS_DISPATCH_TOKEN;
if (!token) throw new Error('CLIENTSDKTESTS_DISPATCH_TOKEN is not set');
fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
  body: JSON.stringify({ event_type: 'ingest-results', client_payload: clientPayload }),
}).then(async (res) => {
  if (res.status !== 204) {
    console.error(`Dispatch failed: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  console.log(`Dispatched to ${REPO}.`);
});
