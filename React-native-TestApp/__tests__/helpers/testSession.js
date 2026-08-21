'use strict';

const { jsSDKTesterBot } = require('./jsSDKTesterBot');
const { clearCapturedEvents } = require('./eventCapture');

/**
 * TestSession - Encapsulates session lifecycle for isolated E2E tests.
 *
 * Credentials are fetched internally — tests don't deal with apiKey/tokens.
 * Bots are created fresh for each test and closed during cleanup.
 * No pooling — each bot gets a clean browser to avoid state leaks.
 *
 * Usage:
 *   const session = await TestSession.create();          // routed
 *   const session = await TestSession.createRelayed();   // P2P
 *
 *   beforeAll: session = await TestSession.create();
 *   in test:   const bot = await session.addBot();   // fresh browser, waits for subscriber
 *   afterEach: await session.cleanup();              // closes all bot browsers
 *   afterAll:  await session.teardown();
 */
class TestSession {
  /**
   * @param {object} params
   * @param {object} params.credentials - Result of getCredentials() or getRelayedCredentials()
   * @param {object} [params.botOptions={}] - Options passed to jsSDKTesterBot constructor
   */
  constructor({ credentials, botOptions = {} }) {
    this.credentials = credentials;
    this.botOptions = { timeout: 30000, ...botOptions };
    /** @type {jsSDKTesterBot[]} Bots active in the current test */
    this.activeBots = [];
    /** Ordered list of bot tokens extracted from credentials at construction */
    this.botTokens = [
      credentials.tokenBot,
      credentials.tokenBot2,
    ].filter(Boolean);
  }

  // --- Factory methods ---

  static async create(botOptions = {}) {
    const { getCredentials } = require('./credentials');
    const credentials = await getCredentials();
    return new TestSession({ credentials, botOptions });
  }

  static async createRelayed(botOptions = {}) {
    const { getRelayedCredentials } = require('./credentials');
    const credentials = await getRelayedCredentials();
    return new TestSession({ credentials, botOptions });
  }

  // --- Bot management ---

  /**
   * Joins a bot to the session. Token is auto-assigned based on position in activeBots.
   *
   * @param {jsSDKTesterBot} bot - Bot instance
   * @param {object} [options]
   * @param {string} [options.token] - Override token
   * @param {string} [options.sessionId] - Override session ID
   * @param {object} [options.publisherOptions] - Publisher options (e.g. { enableDtx: true })
   */
  async joinBot(bot, options = {}) {
    const botIndex = this.activeBots.indexOf(bot);
    const token = options.token || this.botTokens[botIndex] || this.credentials.tokenBot;
    const sessionId = options.sessionId || this.credentials.sessionId;
    await bot.joinSession(
      this.credentials.apiKey,
      sessionId,
      token,
      {
        apiUrl: this.credentials.apiUrl,
        jsSdkUrl: this.credentials.jsSdkUrl,
        ...(options.publisherOptions && { publisherOptions: options.publisherOptions }),
      }
    );
  }

  /**
   * Creates a fresh bot, joins it to the session, and optionally waits
   * for the subscriber view to appear.
   *
   * Each call launches a new browser instance (no pooling).
   * Token is auto-assigned: 1st addBot() → tokenBot, 2nd → tokenBot2.
   *
   * @param {object} [options]
   * @param {string} [options.token] - Override token
   * @param {string} [options.sessionId] - Override session ID
   * @param {object} [options.publisherOptions] - Publisher options
   * @param {boolean} [options.waitForSubscriber=true] - Wait for subscriber view
   * @param {number} [options.subscriberTimeout=20000] - Timeout for subscriber wait (ms)
   * @returns {Promise<jsSDKTesterBot>}
   */
  async addBot(options = {}) {
    const {
      waitForSubscriber: shouldWait = true,
      subscriberTimeout = 20000,
      ...joinOptions
    } = options;

    const bot = new jsSDKTesterBot(this.botOptions);
    await bot.launch();
    this.activeBots.push(bot);

    await this.joinBot(bot, joinOptions);

    if (shouldWait) {
      await waitFor(element(by.id('subscriber'))).toExist().withTimeout(subscriberTimeout);
    }

    return bot;
  }

  // --- App connection ---

  async connectApp() {
    try {
      await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(2000);
      await element(by.id('disconnectSession')).tap();
      await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(7000);
    } catch (_) {}

    await element(by.id('apiKeyInput')).replaceText(this.credentials.apiKey);
    await element(by.id('sessionIdInput')).replaceText(this.credentials.sessionId);
    await element(by.id('tokenInput')).replaceText(this.credentials.tokenApp);
    if (this.credentials.apiUrl) {
      await element(by.id('apiUrlInput')).replaceText(this.credentials.apiUrl);
    }
    // Dismiss keyboard by tapping outside inputs — avoids side effects of
    // tapReturnKey (autocomplete popups on Android, form submit on iOS).
    try {
      await element(by.id('mainScrollView')).tap({ x: 5, y: 5 });
    } catch (_) {}
    await element(by.id('submitButton')).tap();
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(25000);
  }

  async connectAppWithCredentials(apiKey, sessionId, token) {
    try {
      await element(by.id('disconnectSession')).tap();
      await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
    } catch (_) {}

    await element(by.id('apiKeyInput')).replaceText(apiKey);
    await element(by.id('sessionIdInput')).replaceText(sessionId);
    await element(by.id('tokenInput')).replaceText(token);
    await element(by.id('submitButton')).tap();
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(30000);
  }

  async disconnectApp() {
    try {
      await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(3000);
      await element(by.id('disconnectSession')).tap();
      await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(8000);
    } catch (_) {
      // App may already be on the connect screen, or unresponsive — either way, move on.
    }
  }

  // --- Cleanup ---

  /**
   * Per-test cleanup: close all bot browsers, disconnect app, clear events.
   * Bots are fully destroyed (browser closed) — no reuse.
   *
   * If the app is unresponsive (ANR), forces a fresh app relaunch so the
   * next test doesn't inherit a hung state and timeout for 240s.
   */
  async cleanup() {
    for (const bot of this.activeBots) {
      try {
        await bot.close();
      } catch (_) {}
    }
    this.activeBots = [];

    // Attempt graceful disconnect with a short timeout.
    // If this fails (ANR / app hung), force-relaunch below.
    let appResponsive = true;
    try {
      await this.disconnectApp();
      // Verify the app actually responded by checking for the submit button
      await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(6000);
    } catch (e) {
      appResponsive = false;
      console.warn('[cleanup] App unresponsive during disconnect (possible ANR). Force-relaunching.');
    }

    if (!appResponsive) {
      try {
        await device.launchApp({ newInstance: true, permissions: { camera: 'YES', microphone: 'YES' } });
        await device.disableSynchronization();
        const { waitForAppReady } = require('./waitForApp');
        await waitForAppReady();
      } catch (relaunchErr) {
        console.warn('[cleanup] App relaunch also failed:', relaunchErr.message);
      }
    }

    try {
      await clearCapturedEvents();
    } catch (_) {}
  }

  /**
   * Final teardown: close any remaining bot browsers.
   * Safety net — call in afterAll.
   */
  async teardown() {
    for (const bot of this.activeBots) {
      try {
        await bot.close();
      } catch (_) {}
    }
    this.activeBots = [];
  }
}

module.exports = { TestSession };
