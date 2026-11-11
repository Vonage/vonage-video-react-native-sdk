'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');

const { TestSession } = require('./helpers/testSession');
const { hasCredentials } = require('./helpers/credentials');
const { setCaptureFilter, waitForEvent } = require('./helpers/eventCapture');
const { runAppCommand } = require('./helpers/appCommand');
const { itIf } = require('./helpers/itIf');
const { expect: jestExpect } = require('expect');

const SECRET_A = 'rn-e2e-secret-alpha-0001';
const SECRET_B = 'rn-e2e-secret-bravo-0002';
const NO_E2EE = 'no E2EE session: globalSetup could not create one, E2EE is not enabled on the CI project';
const itE2ee = itIf(hasCredentials('e2ee'), NO_E2EE);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * End-to-end encryption on an E2EE session: the app (OTSession encryptionSecret prop and
 * setEncryptionSecret) and the bot (JS SDK) use the same or different secrets.
 */
describe('Encryption', () => {
  let session;

  beforeAll(async () => {
    await launchAndWaitForApp({
      newInstance: true,
      permissions: { camera: 'YES', microphone: 'YES' },
    });

    if (hasCredentials('e2ee')) session = await TestSession.createE2ee();
  });

  afterAll(async () => {
    if (session) await session.teardown();
    await device.terminateApp();
  });

  afterEach(async () => {
    if (session) await session.cleanup();
  });

  async function appStreamId(bot) {
    await bot.waitForRemoteStream({ videoType: 'camera' }, 30000);
    const [stream] = await bot.getRemoteStreams();
    return stream.streamId;
  }

  /** The bot keeps receiving the app's media and its subscriber reports no secret mismatch. */
  async function expectBotDecodes(bot, streamId) {
    const before = await bot.getInboundStats(streamId);
    await sleep(4000);
    const after = await bot.getInboundStats(streamId);
    jestExpect(after.audioPacketsReceived).toBeGreaterThan(before.audioPacketsReceived);
    jestExpect((await bot.getState()).encryption[streamId]).not.toBe('mismatch');
  }

  itE2ee('publish and subscribe work after encryption is configured', async () => {
    await session.connectApp({ encryptionSecret: SECRET_A });
    const bot = await session.addBot({ encryptionSecret: SECRET_A });

    const streamId = await appStreamId(bot);
    await expectBotDecodes(bot, streamId);
    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
  });

  itE2ee('disconnect and reconnect works after encryption was set', async () => {
    await session.connectApp({ encryptionSecret: SECRET_A });
    const bot = await session.addBot({ encryptionSecret: SECRET_A });
    const firstStreamId = await appStreamId(bot);
    await expectBotDecodes(bot, firstStreamId);

    await session.disconnectApp();
    await bot.waitForStreamDestroyed(firstStreamId, 30000);

    const streamCount = await bot.getStreamCount();
    await session.connectApp({ encryptionSecret: SECRET_A });
    await bot.waitForNewStream(streamCount, 30000);
    const secondStreamId = await appStreamId(bot);
    jestExpect(secondStreamId).not.toBe(firstStreamId);
    await expectBotDecodes(bot, secondStreamId);
  });

  itE2ee('setEncryptionSecret during a call updates the secret', async () => {
    await session.connectApp({ encryptionSecret: SECRET_A });
    const bot = await session.addBot({ encryptionSecret: SECRET_A });
    const streamId = await appStreamId(bot);
    await expectBotDecodes(bot, streamId);

    const result = await runAppCommand('setEncryptionSecret', { secret: SECRET_B });
    jestExpect(result.ok).toBe(true);
    await bot.waitForEncryptionState(streamId, 'mismatch');

    await bot.setEncryptionSecret(SECRET_B);
    await bot.waitForEncryptionState(streamId, 'match');
    await expectBotDecodes(bot, streamId);
  });

  itE2ee('wrong or missing secret reports an error', async () => {
    // Publishing on an E2EE session without a secret fails on the publisher.
    await session.connectApp();
    await setCaptureFilter(['publisherError', 'subscriberError']);
    await runAppCommand('republish', { properties: {} });
    const publisherError = await waitForEvent('publisherError', 20000);
    console.log('[encryption] Publisher error without a secret:', JSON.stringify(publisherError));

    // An invalid secret (shorter than 8 characters) is reported to JS.
    await setCaptureFilter(['publisherError', 'subscriberError']);
    const invalid = await runAppCommand('setEncryptionSecret', { secret: 'abc' });
    if (invalid.ok) {
      const sessionError = await waitForEvent('sessionError', 15000);
      console.log('[encryption] Session error for an invalid secret:', JSON.stringify(sessionError));
    }

    // A bot using another secret: the app's subscriber cannot decrypt and reports an error.
    await runAppCommand('setEncryptionSecret', { secret: SECRET_A });
    await setCaptureFilter(['subscriberError']);
    await session.addBot({ encryptionSecret: SECRET_B, waitForSubscriber: false });
    const subscriberError = await waitForEvent('subscriberError', 30000);
    console.log('[encryption] Subscriber error for a different secret:', JSON.stringify(subscriberError));

    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(5000);
  });
});
