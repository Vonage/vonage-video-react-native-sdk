'use strict';

/**
 * Repro / verification kit for issue #306 (and its interaction with #300 / #305).
 *
 * OPT-IN: this suite is skipped unless E2E_MUTEFORCED_REPRO=1, because it needs a
 * second *moderator* client and its expected outcome depends on which of the two
 * fixes are present. See docs/repro-306-ios-muteforced.md.
 *
 * What it does:
 *   1. connects the TestApp to a routed session (moderator token);
 *   2. opens a connect-only moderator page in headless Chromium — no publisher, so it
 *      works on machines where the bot cannot open a fake capture device;
 *   3. has that moderator call `session.forceMuteAll([])`;
 *   4. reads the `session-forceMute` counter, which is incremented only by the
 *      OTSession `muteForced` handler for this trigger (the TestApp's own
 *      `sessionMethodForceMuteAll` also bumps it, so never use the in-app button here).
 *
 * Expected `session-forceMute` after the trigger:
 *
 *   | build                                   | Android | iOS |
 *   |-----------------------------------------|---------|-----|
 *   | develop                                 |    0    |  0  |
 *   | develop + #305 (payload)                |    1    |  0  |
 *   | develop + #307 (selector)               |    0    |  0  |
 *   | develop + #305 + #307                   |    1    |  1  |
 *
 * iOS needs BOTH: #307 makes the native delegate fire at all, #305 gives the payload
 * the top-level `sessionId` that OTSession's routing guard requires.
 */

const { TestSession } = require('./helpers/testSession');
const { jsSDKTesterBot } = require('./helpers/jsSDKTesterBot');
const { expect: jestExpect } = require('expect');

const ENABLED = process.env.E2E_MUTEFORCED_REPRO === '1';
const EXPECT_FIRES = process.env.E2E_MUTEFORCED_EXPECT !== '0';

const describeMaybe = ENABLED ? describe : describe.skip;

async function counter(id) {
  try {
    const attrs = await element(by.id(`session-${id}`)).getAttributes();
    return attrs.text || attrs.label || null;
  } catch (e) {
    return null;
  }
}

describeMaybe('issue #306 — OTSession muteForced from a remote moderator', () => {
  let session;
  let bot;

  beforeAll(async () => {
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

    session = await TestSession.create();
    await session.connectApp();

    // the app must really be connected — the Disconnect button appears optimistically
    // on tap, so assert the counter instead
    await new Promise((resolve) => setTimeout(resolve, 12000));
    jestExpect(await counter('sessionConnected')).toBe('1');
  });

  afterAll(async () => {
    try {
      if (bot) await bot.close();
    } catch (_) {}
    try {
      await session.teardown();
    } catch (_) {}
    await device.terminateApp();
  });

  it(`muteForced handler ${EXPECT_FIRES ? 'fires' : 'does not fire'} when a remote moderator force-mutes`, async () => {
    const { apiKey, sessionId } = session.credentials;
    // needs moderator privileges; globalSetup issues bot tokens as `publisher`, so fall
    // back to the app's own moderator token (tokens may be used by several connections)
    const moderatorToken = session.credentials.tokenModerator || session.credentials.tokenApp;

    bot = new jsSDKTesterBot({ timeout: 30000 });
    await bot.launch();
    await bot.page.setContent(`
      <!DOCTYPE html>
      <html><head><script src="${session.credentials.jsSdkUrl ||
        'https://static.opentok.com/v2/js/opentok.min.js'}"></script></head>
      <body><script>
        window.modState = { connected: false, error: null };
        const s = OT.initSession('${apiKey}', '${sessionId}');
        s.connect('${moderatorToken}', (err) => {
          if (err) { window.modState.error = err.message; return; }
          window.modState.connected = true;
        });
        window.modSession = s;
      </script></body></html>
    `);
    await bot.page.waitForFunction(() => window.modState.connected || window.modState.error, {
      timeout: 30000,
    });
    const modState = await bot.page.evaluate(() => window.modState);
    console.log('[306] moderator page:', JSON.stringify(modState));
    jestExpect(modState.connected).toBe(true);

    const muteResult = await bot.page.evaluate(async () => {
      try {
        await window.modSession.forceMuteAll([]);
        return 'ok';
      } catch (e) {
        return 'error: ' + (e && (e.message || e.name));
      }
    });
    console.log('[306] remote moderator forceMuteAll ->', muteResult);
    jestExpect(muteResult).toBe('ok');

    // poll the counter rather than asserting once — delivery is not instant
    let value = '0';
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      value = await counter('forceMute');
      if (value !== '0') break;
    }
    console.log(
      `[306] platform=${device.getPlatform()} session-forceMute=${value} ` +
        `(streamPropertyChanged=${await counter('streamPropertyChanged')})`
    );

    if (EXPECT_FIRES) {
      jestExpect(value).not.toBe('0');
    } else {
      jestExpect(value).toBe('0');
    }
  });
});
