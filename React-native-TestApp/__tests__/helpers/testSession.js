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
    /** @type {string[]} Publisher tokens; each bot takes the next one by index. */
    this.botTokens = (credentials.botTokens || []).filter(Boolean);
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
   * Joins a bot to the session. Token is auto-assigned by the bot's position
   * in activeBots, indexing into the botTokens pool.
   *
   * @param {jsSDKTesterBot} bot - Bot instance
   * @param {object} [options]
   * @param {string} [options.token] - Override token
   * @param {string} [options.sessionId] - Override session ID
   * @param {object} [options.publisherOptions] - Publisher options (e.g. { enableDtx: true })
   */
  async joinBot(bot, options = {}) {
    const botIndex = this.activeBots.indexOf(bot);
    const token = options.token || this.botTokens[botIndex];
    if (!token) {
      throw new Error(
        `No bot token available for bot #${botIndex + 1}. Only ${this.botTokens.length} ` +
          `tokens were generated. Increase E2E_BOT_POOL_SIZE.`
      );
    }
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
   * Token is auto-assigned by join order from the botTokens pool.
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

  /**
   * Adds `count` bots. Only the first waits for the subscriber view (the rest
   * share the same auto-subscribe view), keeping it fast.
   *
   * @param {number} count
   * @param {object} [options] - Passed through to addBot (except waitForSubscriber)
   * @returns {Promise<jsSDKTesterBot[]>}
   */
  async addBots(count, options = {}) {
    const bots = [];
    for (let i = 0; i < count; i++) {
      const bot = await this.addBot({ ...options, waitForSubscriber: i === 0 });
      bots.push(bot);
    }
    return bots;
  }

  /**
   * Churns the camera on every active bot in parallel.
   * @param {number} iterations - off→on cycles per bot
   * @param {number} [intervalMs=100]
   */
  async churnAllBotsVideo(iterations, intervalMs = 100) {
    await Promise.all(
      this.activeBots.map((bot) => bot.churnVideo(iterations, intervalMs))
    );
  }

  // --- App connection ---

  async connectApp() {
    try {
      await element(by.id('disconnectSession')).tap();
      await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
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
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(30000);
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
      await element(by.id('disconnectSession')).tap();
      await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
    } catch (_) {}
  }

  // --- Cleanup ---

  /**
   * Per-test cleanup: close all bot browsers, disconnect app, clear events.
   * Bots are fully destroyed (browser closed) — no reuse.
   */
  async cleanup() {
    for (const bot of this.activeBots) {
      try {
        await bot.close();
      } catch (_) {}
    }
    this.activeBots = [];

    await this.disconnectApp();

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
