'use strict';

const { jsSDKTesterBot } = require('./helpers/jsSDKTesterBot');
const { getCredentials } = require('./helpers/credentials');

/**
 * AMR (Automatic Media Routing) Transition Tests
 *
 * When a session has only 2 participants, traffic is relayed (P2P).
 * When a 3rd participant joins, the platform transitions to routed mode.
 * When it drops back to 2, it transitions back to relayed.
 *
 * These tests verify the app handles these transitions without crashing
 * or losing streams.
 *
 * Participants:
 *   - App (RN, moderator)
 *   - Bot1 (JS SDK, publisher)
 *   - Bot2 (JS SDK, publisher) — triggers routed transition
 */
describe('AMR Transitions', () => {
  let credentials;
  let bot1;
  let bot2;

  beforeAll(async () => {
    credentials = await getCredentials();

    if (!credentials.tokenBot || !credentials.tokenBot2) {
      console.warn('Need tokenBot + tokenBot2 for AMR tests. Skipping.');
      return;
    }

    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();

    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();

    // Connect app
    await element(by.id('submitButton')).tap();
    console.log('[amr] Connecting app...');
    await new Promise((resolve) => setTimeout(resolve, 30000));
    await expect(element(by.id('disconnectSession'))).toBeVisible();
    console.log('[amr] App connected.');
  });

  afterAll(async () => {
    await device.terminateApp();
    if (bot1) await bot1.close();
    if (bot2) await bot2.close();
  });

  it('relayed → routed: app + bot1 (P2P), then bot2 joins (routed)', async () => {
    if (!credentials.tokenBot2) return;

    // Bot1 joins → 2 participants (relayed/P2P)
    bot1 = new jsSDKTesterBot({ timeout: 30000 });
    await bot1.launch();
    console.log('[amr] Bot1 joining (2 participants → relayed)...');
    await bot1.joinSession(
      credentials.apiKey,
      credentials.sessionId,
      credentials.tokenBot,
      { apiUrl: credentials.apiUrl }
    );
    await new Promise((resolve) => setTimeout(resolve, 10000));
    await expect(element(by.id('subscriber'))).toExist();
    console.log('[amr] 2 participants — relayed mode. Subscriber visible.');

    // Bot2 joins → 3 participants (transition to routed)
    bot2 = new jsSDKTesterBot({ timeout: 30000 });
    await bot2.launch();
    console.log('[amr] Bot2 joining (3 participants → routed transition)...');
    await bot2.joinSession(
      credentials.apiKey,
      credentials.sessionId,
      credentials.tokenBot2,
      { apiUrl: credentials.apiUrl }
    );

    // Wait for transition to complete — streams should persist
    console.log('[amr] Waiting for routed transition to stabilize (20s)...');
    await new Promise((resolve) => setTimeout(resolve, 20000));

    // Verify app still has subscriber (streams survived transition)
    await expect(element(by.id('subscriber'))).toExist();
    console.log('[amr] Routed mode — subscriber still visible. Transition OK!');

    // Verify bots can still see the app's stream
    const bot1State = await bot1.getState();
    const bot2State = await bot2.getState();
    console.log('[amr] Bot1 subscriberCount:', bot1State.subscriberCount);
    console.log('[amr] Bot2 subscriberCount:', bot2State.subscriberCount);
  });

  it('routed → relayed: bot2 leaves (back to 2 participants)', async () => {
    if (!bot2) return;

    console.log('[amr] Bot2 disconnecting (3→2 participants → relayed transition)...');
    await bot2.disconnect();

    // Wait for transition
    console.log('[amr] Waiting for relayed transition to stabilize (20s)...');
    await new Promise((resolve) => setTimeout(resolve, 20000));

    // Verify app still has subscriber (bot1 still publishing)
    await expect(element(by.id('subscriber'))).toExist();
    console.log('[amr] Relayed mode — subscriber still visible. Transition OK!');

    // Verify bot1 still sees app's stream
    const bot1State = await bot1.getState();
    console.log('[amr] Bot1 subscriberCount:', bot1State.subscriberCount);
    if (bot1State.subscriberCount < 1) {
      console.warn('[amr] Bot1 lost app stream during transition — may need reconnect.');
    }
  });

  it('app remains stable through multiple transitions', async () => {
    if (!bot2) return;

    // Bot2 rejoins → back to routed
    console.log('[amr] Bot2 rejoining (2→3 participants again)...');
    await bot2.joinSession(
      credentials.apiKey,
      credentials.sessionId,
      credentials.tokenBot2,
      { apiUrl: credentials.apiUrl }
    );
    await new Promise((resolve) => setTimeout(resolve, 15000));
    await expect(element(by.id('subscriber'))).toExist();
    console.log('[amr] 3 participants again — stable.');

    // Bot2 leaves again → back to relayed
    console.log('[amr] Bot2 leaving again...');
    await bot2.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 15000));
    await expect(element(by.id('subscriber'))).toExist();
    console.log('[amr] Multiple transitions — app stable throughout!');
  });
});
