'use strict';
const { launchAndWaitForApp } = require('./helpers/waitForApp');
const { TestSession } = require('./helpers/testSession');
const {
  setCaptureFilter,
  getLastEvent,
} = require('./helpers/eventCapture');
// Detox replaces the global expect with one for UI elements.
const { expect: jestExpect } = require('expect');

/**
 * Captions translation properties (VIDCS-5281).
 *
 * These tests do not need captions to be enabled in the session: they check
 * that changing translationLanguage and inputLanguage at runtime, with valid,
 * null and invalid values, does not crash the app, does not report an error
 * and keeps the media flowing.
 */
describe('Captions translation', () => {
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
    // tapControl may scroll the main view down. Scroll back so cleanup can
    // reach the disconnect button at the top.
    await element(by.id('mainScrollView'))
      .scrollTo('top')
      .catch(() => {});
    if (session) await session.cleanup();
  });

  // The new buttons are at the end of the controls grid, so scroll if needed.
  const tapControl = async (testID) => {
    await waitFor(element(by.id(testID)))
      .toBeVisible()
      .whileElement(by.id('mainScrollView'))
      .scroll(200, 'down');
    await element(by.id(testID)).tap();
  };

  it('changes the subscriber translation language at runtime', async () => {
    await session.connectApp();
    await setCaptureFilter(['subscriberError']);
    const bot = await session.addBot();

    await element(by.id('tabSubscriber')).tap();
    for (const testID of [
      'setTranslationLanguageEs',
      'setTranslationLanguageFr',
      'setTranslationLanguageOff',
      'setTranslationLanguageInvalid',
      'setTranslationLanguageEs',
    ]) {
      await tapControl(testID);
    }

    await waitFor(element(by.id('subscriber'))).toExist().withTimeout(5000);
    // The bot still receives the app stream, so the session is healthy.
    await bot.waitForStream({ timeout: 30000 });
    jestExpect(await getLastEvent('subscriberError')).toBeNull();
  });

  it('changes the publisher input language at runtime', async () => {
    await session.connectApp();
    await setCaptureFilter(['publisherError']);
    const bot = await session.addBot();
    await bot.waitForStream({ timeout: 30000 });

    await element(by.id('tabPublisher')).tap();
    // Only two values reach the native SDK (it-IT and null). The invalid value
    // stops in JS. More native changes in a short time hit the server rate
    // limit (error 5010).
    for (const testID of [
      'setInputLanguageIt',
      'setInputLanguageInvalid',
      'setInputLanguageOff',
    ]) {
      await tapControl(testID);
    }

    const streams = await bot.getRemoteStreams();
    jestExpect(
      streams.some((s) => s.videoType === 'camera' && s.hasAudio)
    ).toBe(true);
    jestExpect(await getLastEvent('publisherError')).toBeNull();
  });
});
