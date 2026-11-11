'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');
const { TestSession } = require('./helpers/testSession');
const { runAppCommand, runAppCommandOk, resetAppProperties } = require('./helpers/appCommand');
const { expect: jestExpect } = require('expect');

const BLUR = { type: 'backgroundBlur', blurStrength: 'High' };

/**
 * OTPublisher video filter and transformer promises. The visual result (blurred or replaced
 * background) needs a camera and stays a manual check; these tests check what reaches JS.
 */
describe('Video Filters', () => {
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
    if (!session) return;
    await runAppCommand('setVideoTransformers', { transformers: [] }, 10000).catch(() => {});
    await resetAppProperties();
    await session.cleanup();
  });

  async function connectAndPublish() {
    await session.connectApp();
    await waitFor(element(by.id('publisher-streamCreated'))).not.toHaveText('0').withTimeout(30000);
  }

  it('applyVideoFilter background blur resolves and getVideoFilter returns it', async () => {
    await connectAndPublish();

    const applied = await runAppCommand('applyVideoFilter', { filter: BLUR }, 30000);
    jestExpect(applied).toEqual(jestExpect.objectContaining({ ok: true, value: BLUR }));
    jestExpect(await runAppCommandOk('getVideoFilter')).toEqual(BLUR);
  });

  it('applyVideoFilter background replacement resolves', async () => {
    await connectAndPublish();

    const applied = await runAppCommand(
      'applyVideoFilter',
      { filter: { type: 'backgroundReplacement', backgroundImgUrl: '$bundledImage' } },
      30000
    );
    jestExpect(applied.ok).toBe(true);
    jestExpect(applied.value).toEqual(
      jestExpect.objectContaining({ type: 'backgroundReplacement', backgroundImgUrl: jestExpect.any(String) })
    );
  });

  it('clearVideoFilter resolves and getVideoFilter returns null', async () => {
    await connectAndPublish();
    await runAppCommandOk('applyVideoFilter', { filter: BLUR }, 30000);

    const cleared = await runAppCommand('clearVideoFilter', {}, 30000);
    jestExpect(cleared).toEqual(jestExpect.objectContaining({ ok: true, value: null }));
    jestExpect(await runAppCommandOk('getVideoFilter')).toBeNull();
  });

  it('setVideoTransformers resolves for valid lists and rejects for invalid ones', async () => {
    await connectAndPublish();

    const valid = await runAppCommand(
      'setVideoTransformers',
      { transformers: [{ name: 'BackgroundBlur', properties: JSON.stringify({ radius: 'High' }) }] },
      30000
    );
    jestExpect(valid.ok).toBe(true);

    const invalid = await runAppCommand('setVideoTransformers', { transformers: [{ name: 'Unknown', properties: '' }] }, 30000);
    jestExpect(invalid.ok).toBe(false);
    jestExpect(invalid.error.message).toBeTruthy();

    // The previous custom transformers are kept: a built-in filter is refused while they are set.
    const blocked = await runAppCommand('applyVideoFilter', { filter: BLUR }, 30000);
    jestExpect(blocked.ok).toBe(false);
    jestExpect(blocked.error.code).toBe('OT_NOT_SUPPORTED');

    const empty = await runAppCommand('setVideoTransformers', { transformers: [] }, 30000);
    jestExpect(empty.ok).toBe(true);
    const afterEmpty = await runAppCommand('applyVideoFilter', { filter: BLUR }, 30000);
    jestExpect(afterEmpty.ok).toBe(true);
  });
});
