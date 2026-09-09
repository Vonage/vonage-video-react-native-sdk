'use strict';

const { TestSession } = require('./helpers/testSession');
const { expect: jestExpect } = require('expect');

/**
 * Camera Churn Stress Tests (VIDCS-4941)
 *
 * This file uses the `.stress.js` suffix (not `.e2e.js`) so it is NOT picked up
 * by the default CI run (testMatch: **\/*.e2e.js). Run it explicitly:
 *
 *   npm run test:e2e:android:suite cameraChurn
 *
 * Tunables: E2E_CHURN_BOTS (4), E2E_CHURN_ITERATIONS (40), E2E_CHURN_INTERVAL (75ms),
 * E2E_TURNOVER_ROUNDS (6), E2E_STATS_DWELL (2500ms).
 * Bots take tokens from the pool sized by E2E_BOT_POOL_SIZE in globalSetup.
 *
 * Scenarios are labelled by the live-SDK-read route they target (see spec):
 *   Route A — property-change callbacks (camera toggles).
 *   Route B — stats/lifecycle callbacks racing stream teardown (peer turnover).
 *   Route C — local publisher + findStream path under churn.
 */

const REQUESTED_BOTS = parseInt(process.env.E2E_CHURN_BOTS || '4', 10);
const CHURN_ITERATIONS = parseInt(process.env.E2E_CHURN_ITERATIONS || '40', 10);
const CHURN_INTERVAL_MS = parseInt(process.env.E2E_CHURN_INTERVAL || '75', 10);
// Route B: rounds of peer turnover, and how long to let stats callbacks flow
// (onAudioStats/onVideoStats fire ~1 Hz per subscriber) before/while tearing down.
const TURNOVER_ROUNDS = parseInt(process.env.E2E_TURNOVER_ROUNDS || '6', 10);
const STATS_DWELL_MS = parseInt(process.env.E2E_STATS_DWELL || '2500', 10);

// App batches event counters and flushes to state once per second.
const COUNTER_FLUSH_MS = 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function assertAppAlive() {
  await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(10000);
  await waitFor(element(by.id('subscriber'))).toExist().withTimeout(10000);
}

// Clamps the requested bot count to the tokens actually available in the pool.
function resolveBotCount(session) {
  const available = session.botTokens.length;
  if (REQUESTED_BOTS > available) {
    console.warn(
      `[cameraChurn] Requested ${REQUESTED_BOTS} bots but only ${available} tokens ` +
        `available. Set E2E_BOT_POOL_SIZE=${REQUESTED_BOTS}. Capping to ${available}.`
    );
  }
  return Math.min(REQUESTED_BOTS, available);
}

async function launchAppForE2E() {
  // On iOS, Detox synchronizes during launchApp() itself and hangs while the
  // Video SDK keeps the main queue busy, so disable sync via launchArgs there.
  const isIOS = device.getPlatform() === 'ios';
  await device.launchApp({
    newInstance: true,
    ...(isIOS
      ? { launchArgs: { detoxEnableSynchronization: 0, detoxPrintBusyIdleResources: 'YES' } }
      : {}),
    permissions: { camera: 'YES', microphone: 'YES' },
  });
  await device.disableSynchronization();

  const { waitForAppReady } = require('./helpers/waitForApp');
  await waitForAppReady();
}

describe('Camera Churn Stress (Android repro)', () => {
  let session;

  beforeAll(async () => {
    await launchAppForE2E();
  });

  afterAll(async () => {
    if (session) await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    if (session) await session.cleanup();
  });

  // Single remote peer, rapid camera churn (routed).
  it('survives rapid camera churn from a single remote peer (routed)', async () => {
    session = await TestSession.create();
    await session.connectApp();
    await session.addBot();

    await element(by.id('resetEventIndicators')).tap();
    await session.churnAllBotsVideo(CHURN_ITERATIONS, CHURN_INTERVAL_MS);
    await sleep(COUNTER_FLUSH_MS);

    await waitFor(element(by.id('subscriber-videoDisabled'))).not.toHaveText('0').withTimeout(10000);
    await assertAppAlive();
  });

  // Multiple remote peers churning concurrently (routed) — reproduces more easily.
  it('survives concurrent camera churn from multiple remote peers (routed)', async () => {
    session = await TestSession.create();
    await session.connectApp();

    const botCount = resolveBotCount(session);
    const bots = await session.addBots(botCount);
    jestExpect(bots.length).toBe(botCount);

    await element(by.id('resetEventIndicators')).tap();

    await session.churnAllBotsVideo(CHURN_ITERATIONS, CHURN_INTERVAL_MS);
    await sleep(COUNTER_FLUSH_MS);
    await assertAppAlive();

    await waitFor(element(by.id('subscriber-videoDisabled'))).not.toHaveText('0').withTimeout(10000);
  });

  // Churn racing against peer join/leave teardown — the use-after-free window.
  it('survives camera churn interleaved with peer join/leave turnover (routed)', async () => {
    session = await TestSession.create();
    await session.connectApp();

    const initial = Math.max(2, Math.min(resolveBotCount(session), 3));
    await session.addBots(initial);

    await element(by.id('resetEventIndicators')).tap();
    await session.churnAllBotsVideo(CHURN_ITERATIONS, CHURN_INTERVAL_MS);

    const leaving = session.activeBots[session.activeBots.length - 1];
    await Promise.all([
      leaving.churnVideo(CHURN_ITERATIONS, CHURN_INTERVAL_MS).catch(() => {}),
      leaving.disconnect(),
    ]);

    await session.addBot({ waitForSubscriber: false });
    await session.churnAllBotsVideo(CHURN_ITERATIONS, CHURN_INTERVAL_MS);

    await sleep(COUNTER_FLUSH_MS);
    await assertAppAlive();
  });

  // ROUTE B — stats/lifecycle callbacks racing stream teardown.
  //
  // Targets the direct-live-read callbacks: onAudioStats/onVideoStats (~1 Hz per
  // subscriber) plus onDisconnected/onError. Mechanism: keep several subscribed
  // peers so stats flow continuously, then repeatedly turn peers over (disconnect
  // + add fresh) while stats are in flight. A stats/lifecycle callback delivered
  // just after the SDK freed the torn-down stream is the use-after-free window.
  it('survives stats/lifecycle callbacks racing peer turnover (routed, Route B)', async () => {
    session = await TestSession.create();
    await session.connectApp();

    const botCount = resolveBotCount(session);
    await session.addBots(botCount);

    await element(by.id('resetEventIndicators')).tap();

    // Let stats callbacks accumulate so there are in-flight events to race.
    await sleep(STATS_DWELL_MS);

    const turnover = Math.max(1, Math.floor(botCount / 2));
    for (let round = 1; round <= TURNOVER_ROUNDS; round++) {
      // Churn video (Route A pressure) while turning peers over (Route B pressure),
      // concurrently, so property callbacks and stats/lifecycle callbacks interleave
      // with teardown.
      await Promise.all([
        session.churnAllBotsVideo(CHURN_ITERATIONS, CHURN_INTERVAL_MS).catch(() => {}),
        session.replaceBots(turnover),
      ]);
      await sleep(STATS_DWELL_MS);
      await assertAppAlive();
    }
  });

  // ROUTE C — local publisher + findStream path under churn.
  //
  // Targets the publisher-side lifecycle and the findStream publisher resolution
  // path. Mechanism: the app publishes locally (default) while remote peers churn
  // and are subscribed; combined with local unpublish/republish to exercise the
  // publisher stream lifecycle while events are flowing.
  it('survives local publisher churn alongside remote peers (routed, Route C)', async () => {
    session = await TestSession.create();
    await session.connectApp();

    const botCount = resolveBotCount(session);
    await session.addBots(botCount);

    await element(by.id('resetEventIndicators')).tap();

    const ROUNDS = 3;
    for (let round = 1; round <= ROUNDS; round++) {
      // Remote churn while toggling the local publisher off/on (unpublish/republish).
      await session.churnAllBotsVideo(CHURN_ITERATIONS, CHURN_INTERVAL_MS).catch(() => {});

      await element(by.id('tabSession')).tap();
      await element(by.id('stopPublishing')).tap(); // unpublish
      await sleep(500);
      await element(by.id('stopPublishing')).tap(); // republish
      await sleep(STATS_DWELL_MS);
      await assertAppAlive();
    }
  });

  // Same churn under a relayed (P2P) topology — different media path.
  it('survives camera churn from a remote peer (relayed / P2P)', async () => {
    session = await TestSession.createRelayed();
    await session.connectApp();
    await session.addBot();

    await element(by.id('resetEventIndicators')).tap();
    await session.churnAllBotsVideo(CHURN_ITERATIONS, CHURN_INTERVAL_MS);

    await sleep(COUNTER_FLUSH_MS);
    await assertAppAlive();
  });
});
