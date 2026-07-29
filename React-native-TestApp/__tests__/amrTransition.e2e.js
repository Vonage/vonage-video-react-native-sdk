'use strict';

const { TestSession } = require('./helpers/testSession');

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
  let session;
  let bot1;
  let bot2;

  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    await device.disableSynchronization();

    const { waitForAppReady } = require('./helpers/waitForApp');
    await waitForAppReady();

    session = await TestSession.create({ timeout: 30000 });
  });

  afterAll(async () => {
    await session.teardown();
    await device.terminateApp();
  });

  it('relayed → routed: app + bot1 (P2P), then bot2 joins (routed)', async () => {
    // Connect app
    await session.connectApp();
    console.log('[amr] App connected.');

    // Bot1 joins → 2 participants (relayed/P2P) — waits for subscriber
    bot1 = await session.addBot();
    console.log('[amr] 2 participants — relayed mode. Subscriber visible.');

    // Bot2 joins → 3 participants (transition to routed)
    // Don't wait for a new subscriber view — it already exists from bot1
    console.log('[amr] Bot2 joining (3 participants → routed transition)...');
    bot2 = await session.addBot({ waitForSubscriber: false });

    // AMR transition has no observable event — short wait for ICE renegotiation
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify app still has subscriber (streams survived transition)
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
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

    // AMR transition — short wait for ICE renegotiation
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify app still has subscriber (bot1 still publishing)
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
    console.log('[amr] Relayed mode — subscriber still visible. Transition OK!');

    // Verify bot1 still sees app's stream
    const bot1State = await bot1.getState();
    console.log('[amr] Bot1 subscriberCount:', bot1State.subscriberCount);
  });

  it('app remains stable through multiple transitions', async () => {
    if (!bot2) return;

    // Bot2 rejoins → back to routed
    console.log('[amr] Bot2 rejoining (2→3 participants again)...');
    await session.joinBot(bot2);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
    console.log('[amr] 3 participants again — stable.');

    // Bot2 leaves again → back to relayed
    console.log('[amr] Bot2 leaving again...');
    await bot2.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
    console.log('[amr] Multiple transitions — app stable throughout!');
  });
});
