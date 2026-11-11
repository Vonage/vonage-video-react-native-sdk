'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');
const { TestSession } = require('./helpers/testSession');
const { setCaptureFilter, waitForEvent } = require('./helpers/eventCapture');
const { runAppCommand, runAppCommandOk } = require('./helpers/appCommand');
const { itIf } = require('./helpers/itIf');
const { expect: jestExpect } = require('expect');

// OTSession.signal() returns void and the native layers drop signal errors: sendSignal is void in
// src/NativeOpentok.ts, ios/OpentokReactNative.mm ignores the Swift reject, and Android
// sendSignal returns early for an unknown connection. No error can reach JS without an SDK change.
const NO_SIGNAL_ERRORS = 'SDK gap: signal errors are not reported to JS (OTSession.signal() returns void)';

/** OTSession.signal() and the signal event handler, checked against bots. */
describe('Signaling', () => {
  let session;

  beforeAll(async () => {
    await launchAndWaitForApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    session = await TestSession.create();
  });

  afterAll(async () => {
    if (session) await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    if (session) await session.cleanup();
  });

  /** Connects the app, adds `count` bots and returns them with the app's connectionId. */
  async function connectWithBots(count) {
    await session.connectApp();
    await setCaptureFilter(['signal']);
    const bots = [];
    for (let i = 0; i < count; i++) {
      bots.push(await session.addBot({ waitForSubscriber: i === 0 }));
    }
    await bots[0].waitForRemoteStream({ videoType: 'camera' }, 30000);
    const [appStream] = await bots[0].getRemoteStreams();
    return { bots, appConnectionId: appStream.connectionId };
  }

  it('broadcast signal reaches every participant and the sender', async () => {
    const { bots, appConnectionId } = await connectWithBots(2);
    const [botA, botB] = bots;

    await runAppCommandOk('signal', { type: 'chat', data: 'hello' });
    for (const bot of bots) {
      const received = await bot.waitForSignal({ type: 'chat', data: 'hello' });
      jestExpect(received.from).toBe(appConnectionId);
    }
    const own = await waitForEvent('signal', 15000, (e) => e.data === 'hello');
    jestExpect(own).toEqual(jestExpect.objectContaining({ type: 'chat', data: 'hello', connectionId: appConnectionId }));

    await botA.sendSignal({ type: 'chat', data: 'from-bot' });
    const fromBot = await waitForEvent('signal', 15000, (e) => e.data === 'from-bot');
    jestExpect(fromBot).toEqual(
      jestExpect.objectContaining({ type: 'chat', data: 'from-bot', connectionId: await botA.getConnectionId() })
    );
    await botB.waitForSignal({ type: 'chat', data: 'from-bot' });
  });

  it('targeted signal reaches only the target connection', async () => {
    const { bots } = await connectWithBots(2);
    const [botA, botB] = bots;

    await runAppCommandOk('signal', { type: 'direct', data: 'only-a', to: await botA.getConnectionId() });
    await botA.waitForSignal({ type: 'direct', data: 'only-a' });

    // Signals from one sender arrive in order, so once botB has the broadcast sent afterwards it
    // would already have the targeted one.
    await runAppCommandOk('signal', { type: 'barrier', data: 'after' });
    await botB.waitForSignal({ type: 'barrier', data: 'after' });
    jestExpect(await botB.getSignals()).not.toContainEqual(jestExpect.objectContaining({ data: 'only-a' }));
  });

  itIf(false, NO_SIGNAL_ERRORS)('signal to an unknown connection id is rejected', async () => {
    const { bots } = await connectWithBots(1);
    await setCaptureFilter(['signal']);
    await runAppCommandOk('signal', { type: 'direct', data: 'nobody', to: 'not-a-connection-id' });
    await runAppCommandOk('signal', { type: 'barrier', data: 'after' });
    await bots[0].waitForSignal({ type: 'barrier', data: 'after' });
    jestExpect(await bots[0].getSignals()).not.toContainEqual(jestExpect.objectContaining({ data: 'nobody' }));
    await waitForEvent('sessionError', 10000);
  });

  itIf(false, NO_SIGNAL_ERRORS)('invalid signals report an error', async () => {
    const { bots } = await connectWithBots(1);
    for (const signal of [{ type: '<>!', data: 'bad-type' }, { type: 'big', data: 'x'.repeat(8 * 1024 + 1) }]) {
      await setCaptureFilter(['signal']);
      await runAppCommandOk('signal', signal);
      await waitForEvent('sessionError', 10000);
    }
    jestExpect(await bots[0].getSignals()).toEqual([]);
    const afterDisconnect = await runAppCommand('afterDisconnect', {
      command: { op: 'signal', type: 'late', data: 'after-disconnect' },
    });
    jestExpect(afterDisconnect.ok).toBe(false);
  });

  it('signal data keeps Unicode and JSON intact', async () => {
    const { bots } = await connectWithBots(1);
    const [bot] = bots;
    const data = JSON.stringify({ text: 'héllo 👋' });

    await runAppCommandOk('signal', { type: 'json', data });
    const atBot = await bot.waitForSignal({ type: 'json' });
    jestExpect(atBot.data).toBe(data);

    const reply = JSON.stringify({ text: 'réponse 👍', n: 1 });
    await bot.sendSignal({ type: 'json', data: reply });
    const atApp = await waitForEvent('signal', 15000, (e) => e.type === 'json' && e.data !== data);
    jestExpect(atApp.data).toBe(reply);
    jestExpect(JSON.parse(atApp.data)).toEqual({ text: 'réponse 👍', n: 1 });
  });
});
