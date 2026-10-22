'use strict';

const { TestSession } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent, clearCapturedEvents } = require('./helpers/eventCapture');
const { forceDisconnect, forceUnpublish, listStreams } = require('./helpers/openTokRest');
const { captureInstanceCounts } = require('./helpers/heapInstances');
const { resolveAndroidSerial } = require('./helpers/adbDevice');
const { expect: jestExpect } = require('expect');

/**
 * Publisher Leak Repro (VIDCS-5069)
 *
 * This file uses the `.stress.js` suffix (not `.e2e.js`) so it is NOT picked
 * up by the default CI run (testMatch: **\/*.e2e.js). It only runs on Android
 * (it shells out to `adb`/`am dumpheap` to count live heap instances) and
 * requires E2E_API_KEY/E2E_API_SECRET (for the REST forceDisconnect call).
 *
 * Run explicitly:
 *   npm run test:e2e:android:suite publisherLeak
 *
 * WHAT THIS REPRODUCES
 *
 * The publisher entry in OTRN's static shared-state map is only removed by
 * OpentokReactNativeModule.unpublish(), and (pre-fix) that removal was gated
 * on the session still being present. On an involuntary disconnect,
 * onDisconnected() removes the session BEFORE the JS side unmounts the
 * publisher, so the later unpublish() call no-ops and the native Publisher
 * (with its camera capturer and view listeners) is orphaned in the map for
 * the process lifetime.
 *
 * A manual "Unpublish"/"Publish" toggle in the app does NOT reproduce this:
 * with the session still connected, unpublish() already reaches the remove
 * call. The leak only shows up when the SESSION disconnects while the
 * publisher is still mounted — which is what this test forces via the REST
 * API (force-disconnecting the app's own connection), repeated N times.
 *
 * GETTING THE APP'S OWN connectionId
 *
 * connectionCreated is only fired by the native SDK for REMOTE connections
 * (see OpentokReactNativeModule.onConnected vs onConnectionCreated), so it
 * never fires for the app's own connection. The app's own connectionId comes
 * from the sessionConnected event payload instead.
 *
 * renderCaptureControls() in VideoCallScreen only renders the capture-filter
 * UI once connectedToSession is true, so the filter can't be armed before
 * the FIRST connect. Work around that by connecting once (event lost, not
 * needed yet), arming the filter now that the UI exists, then reconnecting
 * once more so the sessionConnected this test reads fires with the filter
 * already active.
 */

const CHURN_ROUNDS = parseInt(process.env.E2E_LEAK_ROUNDS || '8', 10);
const SETTLE_MS = parseInt(process.env.E2E_LEAK_SETTLE_MS || '4000', 10);
// Growth tolerance: real GC/finalizer timing can leave a couple of instances
// transiently un-collected. The leak this test targets grows ~1:1 with
// CHURN_ROUNDS, so this tolerance is intentionally far below that slope.
const MAX_ALLOWED_GROWTH = parseInt(process.env.E2E_LEAK_TOLERANCE || '2', 10);

const LEAK_CLASSES = ['com.opentok.android.Publisher', 'com.opentokreactnative.OTRNPublisher'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function launchAppForE2E() {
  await device.launchApp({
    newInstance: true,
    permissions: { camera: 'YES', microphone: 'YES' },
  });
  await device.disableSynchronization();

  const { waitForAppReady } = require('./helpers/waitForApp');
  await waitForAppReady();
}

describe('Publisher Leak Repro (Android only, VIDCS-5069)', () => {
  let session;
  let serial;

  beforeAll(async () => {
    if (device.getPlatform() !== 'android') {
      return;
    }
    serial = resolveAndroidSerial();
    await launchAppForE2E();
  });

  afterAll(async () => {
    if (device.getPlatform() !== 'android') {
      return;
    }
    if (session) await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    if (device.getPlatform() !== 'android') {
      return;
    }
    if (session) await session.cleanup();
  });

  it('does not accumulate Publisher/OTRNPublisher instances across forced session disconnects', async () => {
    if (device.getPlatform() !== 'android') {
      console.log('[publisherLeak] Skipping — Android-only test.');
      return;
    }

    const apiKey = process.env.E2E_API_KEY;
    const apiSecret = process.env.E2E_API_SECRET;
    if (!apiKey || !apiSecret) {
      console.log('[publisherLeak] E2E_API_KEY/E2E_API_SECRET not set — skipping.');
      return;
    }

    session = await TestSession.create();

    await session.connectApp();
    await setCaptureFilter(['sessionConnected']);
    await session.disconnectApp();
    await session.connectApp();
    console.log('[publisherLeak] App connected.');

    const connEvent = await waitForEvent('sessionConnected', 15000);
    let appConnectionId = connEvent.connectionId;
    jestExpect(appConnectionId).toBeTruthy();
    console.log('[publisherLeak] App connectionId:', appConnectionId);

    await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);
    await sleep(SETTLE_MS);

    const baseline = await captureInstanceCounts({ serial, classNames: LEAK_CLASSES });
    console.log('[publisherLeak] Baseline counts:', JSON.stringify(baseline));

    for (let round = 1; round <= CHURN_ROUNDS; round++) {
      // captureFilter is component state, not reset by connect/disconnect, so
      // it does not need to be re-applied after reconnecting below. Only the
      // captured payload needs clearing so waitForEvent doesn't read a stale
      // sessionConnected from a previous round.
      await clearCapturedEvents();

      // DEBUG: check whether the backend sees ANY activity for this session
      // at all before trying forceDisconnect.
      const streamCheck = await listStreams(apiKey, apiSecret, session.credentials.apiUrl, session.credentials.sessionId);
      console.log(`[publisherLeak] Round ${round}: GET stream status=${streamCheck.status} body=${streamCheck.body}`);

      // DEBUG: try forceUnpublish on the streamId from the GET above, as a
      // control — if THIS succeeds while forceDisconnect on the connectionId
      // 404s, the problem is specific to the /connection endpoint or to how
      // the connectionId is being read, not to the backend not seeing the
      // session/participant at all.
      try {
        const streamBody = JSON.parse(streamCheck.body);
        const streamId = streamBody.items && streamBody.items[0] && streamBody.items[0].id;
        if (streamId) {
          console.log(`[publisherLeak] Round ${round}: DEBUG trying forceUnpublish on streamId=${streamId}`);
          await forceUnpublish(apiKey, apiSecret, session.credentials.apiUrl, session.credentials.sessionId, streamId);
          console.log(`[publisherLeak] Round ${round}: DEBUG forceUnpublish SUCCEEDED on streamId=${streamId}`);
        } else {
          console.log(`[publisherLeak] Round ${round}: DEBUG no streamId available from GET stream.`);
        }
      } catch (err) {
        console.log(`[publisherLeak] Round ${round}: DEBUG forceUnpublish failed: ${err.message}`);
      }

      // Force-disconnect the APP's own connection (not a bot's). This fires
      // onDisconnected() on the Android client while the OTPublisher view is
      // still mounted — the exact precondition for the leak.
      //
      // DEBUG: loop the raw call here (instead of relying on the silent
      // retry inside forceDisconnect) to see, attempt by attempt, whether
      // and when the backend stops 404'ing on this connectionId.
      {
        const maxAttempts = 10;
        let succeeded = false;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            await forceDisconnect(
              apiKey,
              apiSecret,
              session.credentials.apiUrl,
              session.credentials.sessionId,
              appConnectionId,
              { retries: 0 }
            );
            console.log(
              `[publisherLeak] Round ${round}: forceDisconnect succeeded on attempt ${attempt} for ${appConnectionId}`
            );
            succeeded = true;
            break;
          } catch (err) {
            console.log(
              `[publisherLeak] Round ${round}: forceDisconnect attempt ${attempt} failed: ${err.message}`
            );
            await sleep(1500);
          }
        }
        if (!succeeded) {
          throw new Error(
            `[publisherLeak] Round ${round}: forceDisconnect never succeeded after ${maxAttempts} attempts for ${appConnectionId}`
          );
        }
      }

      // The app should reflect the disconnect (submitButton reappears).
      await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(15000);

      // Reconnect and republish for the next round.
      await session.connectApp();
      const nextConnEvent = await waitForEvent('sessionConnected', 15000);
      appConnectionId = nextConnEvent.connectionId;
      jestExpect(appConnectionId).toBeTruthy();

      await waitFor(element(by.id('publisher'))).toExist().withTimeout(15000);
    }

    await sleep(SETTLE_MS);

    const final = await captureInstanceCounts({ serial, classNames: LEAK_CLASSES });
    console.log('[publisherLeak] Final counts:', JSON.stringify(final));

    for (const className of LEAK_CLASSES) {
      const growth = final[className] - baseline[className];
      console.log(
        `[publisherLeak] ${className}: baseline=${baseline[className]} final=${final[className]} growth=${growth}`
      );
      jestExpect(growth).toBeLessThanOrEqual(MAX_ALLOWED_GROWTH);
    }
  });
});
