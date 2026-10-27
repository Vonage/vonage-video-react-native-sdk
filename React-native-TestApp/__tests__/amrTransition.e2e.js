'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');

const { TestSession } = require('./helpers/testSession');

/**
 * AMR (Automatic Media Routing) transitions: a session with 2 participants is relayed (P2P) and
 * becomes routed when a 3rd joins. Verifies the app keeps its streams across the transitions.
 */
describe('AMR Transitions', () => {
  let session;

  beforeAll(async () => {
    await launchAndWaitForApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });

    session = await TestSession.create({ timeout: 30000 });
  });

  afterAll(async () => {
    if (session) await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    if (session) await session.cleanup();
  });

  async function joinRelayed() {
    await session.connectApp();
    const bot1 = await session.addBot();
    console.log('[amr] 2 participants — relayed mode. Subscriber visible.');
    return bot1;
  }

  async function joinRouted() {
    const bot1 = await joinRelayed();
    // Don't wait for a new subscriber view — it already exists from bot1
    const bot2 = await session.addBot({ waitForSubscriber: false });
    // AMR transition has no observable event — short wait for ICE renegotiation
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return { bot1, bot2 };
  }

  it('relayed → routed: app + bot1 (P2P), then bot2 joins (routed)', async () => {
    console.log('[amr] Bot2 joining (3 participants → routed transition)...');
    const { bot1, bot2 } = await joinRouted();

    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
    console.log('[amr] Routed mode — subscriber still visible. Transition OK!');

    const bot1State = await bot1.getState();
    const bot2State = await bot2.getState();
    console.log('[amr] Bot1 subscriberCount:', bot1State.subscriberCount);
    console.log('[amr] Bot2 subscriberCount:', bot2State.subscriberCount);
  });

  it('routed → relayed: bot2 leaves (back to 2 participants)', async () => {
    const { bot1, bot2 } = await joinRouted();

    console.log('[amr] Bot2 disconnecting (3→2 participants → relayed transition)...');
    await bot2.disconnect();

    await new Promise((resolve) => setTimeout(resolve, 5000));

    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
    console.log('[amr] Relayed mode — subscriber still visible. Transition OK!');

    const bot1State = await bot1.getState();
    console.log('[amr] Bot1 subscriberCount:', bot1State.subscriberCount);
  });

  it('app remains stable through multiple transitions', async () => {
    const { bot2 } = await joinRouted();
    await bot2.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log('[amr] Bot2 rejoining (2→3 participants again)...');
    await session.joinBot(bot2);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
    console.log('[amr] 3 participants again — stable.');

    console.log('[amr] Bot2 leaving again...');
    await bot2.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
    console.log('[amr] Multiple transitions — app stable throughout!');
  });
});
