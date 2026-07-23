'use strict';

const { jsSDKTesterBot } = require('./jsSDKTesterBot');
const { clearCapturedEvents } = require('./eventCapture');

/**
 * TestSession - Encapsulates session lifecycle for isolated E2E tests.
 *
 * Credentials are fetched internally — tests don't deal with apiKey/tokens.
 * Bots are managed on-demand — each test requests the bots it needs.
 * Browser instances are pooled for reuse (launch is expensive, join is cheap).
 * Bot tokens are auto-assigned from credentials: 1st bot → tokenBot, 2nd → tokenBot2.
 *
 * Usage:
 *   const session = await TestSession.create();          // routed
 *   const session = await TestSession.createRelayed();   // P2P
 *
 *   beforeAll: session = await TestSession.create();
 *   in test:   const bot = await session.addBot();   // auto-assigns tokenBot, waits for subscriber
 *              const bot2 = await session.addBot();  // auto-assigns tokenBot2, waits for subscriber
 *   afterEach: await session.cleanup();
 *   afterAll:  await session.teardown();
 */
class TestSession {
  /**
   * Creates a TestSession. Prefer using the static factory methods:
   *   const session = await TestSession.create();          // routed session
   *   const session = await TestSession.createRelayed();   // relayed/P2P session
   *
   * @param {object} params
   * @param {object} params.credentials - Result of getCredentials() or getRelayedCredentials()
   * @param {object} [params.botOptions={}] - Options passed to jsSDKTesterBot constructor
   */
  constructor({ credentials, botOptions = {} }) {
    this.credentials = credentials;
    this.botOptions = { timeout: 30000, ...botOptions };
    /** @type {jsSDKTesterBot[]} Pool of reusable browser instances */
    this.botPool = [];
    /** @type {jsSDKTesterBot[]} Bots active in the current test */
    this.activeBots = [];
    /** Ordered list of bot tokens extracted from credentials at construction */
    this.botTokens = [
      credentials.tokenBot,
      credentials.tokenBot2,
    ].filter(Boolean);
  }

  /**
   * Factory: creates a TestSession with routed session credentials.
   * Fetches credentials internally — tests don't need to know about them.
   *
   * @param {object} [botOptions] - Options for jsSDKTesterBot instances
   * @returns {Promise<TestSession>}
   */
  static async create(botOptions = {}) {
    const { getCredentials } = require('./credentials');
    const credentials = await getCredentials();
    return new TestSession({ credentials, botOptions });
  }

  /**
   * Factory: creates a TestSession with relayed (P2P) session credentials.
   *
   * @param {object} [botOptions] - Options for jsSDKTesterBot instances
   * @returns {Promise<TestSession>}
   */
  static async createRelayed(botOptions = {}) {
    const { getRelayedCredentials } = require('./credentials');
    const credentials = await getRelayedCredentials();
    return new TestSession({ credentials, botOptions });
  }

  /**
   * Creates (or reuses from pool) a bot browser instance and returns it.
   * Does NOT join the session — call joinBot() separately.
   *
   * This separation lets the test control exactly when and how many
   * participants are in the session (important for relayed vs routed).
   *
   * @returns {Promise<jsSDKTesterBot>}
   */
  async createBot() {
    let bot;
    if (this.botPool.length > 0) {
      bot = this.botPool.pop();
    } else {
      bot = new jsSDKTesterBot(this.botOptions);
      await bot.launch();
    }
    this.activeBots.push(bot);
    return bot;
  }

  /**
   * Joins a bot to the session. Token is auto-assigned based on the bot's
   * position in activeBots (1st bot → tokenBot, 2nd → tokenBot2).
   * Override with options.token only for special cases.
   *
   * @param {jsSDKTesterBot} bot - Bot instance from createBot()
   * @param {object} [options]
   * @param {string} [options.token] - Override token (defaults to auto-assigned from credentials)
   * @param {string} [options.sessionId] - Override session ID
   * @param {object} [options.publisherOptions] - Override publisher options (e.g. { enableDtx: true })
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
   * Convenience: creates a bot AND joins it to the session in one call.
   * Token is auto-assigned: 1st addBot() → tokenBot, 2nd → tokenBot2.
   *
   * By default, waits for the subscriber view to appear in the app UI
   * before returning (proves media is flowing). Pass { waitForSubscriber: false }
   * to skip this (e.g., when the app is not yet connected).
   *
   * @param {object} [options]
   * @param {string} [options.token] - Override token
   * @param {string} [options.sessionId] - Override session ID
   * @param {boolean} [options.waitForSubscriber=true] - Wait for subscriber view to appear
   * @param {number} [options.subscriberTimeout=20000] - Timeout for subscriber wait (ms)
   * @returns {Promise<jsSDKTesterBot>}
   */
  async addBot(options = {}) {
    const {
      waitForSubscriber: shouldWait = true,
      subscriberTimeout = 20000,
      ...joinOptions
    } = options;

    const bot = await this.createBot();
    await this.joinBot(bot, joinOptions);

    if (shouldWait) {
      await waitFor(element(by.id('subscriber'))).toExist().withTimeout(subscriberTimeout);
    }

    return bot;
  }

  /**
   * Connects the app to the session using the credentials stored in this TestSession.
   * Waits for sessionConnected (disconnect button visible) before returning.
   * Handles the case where the app is already connected (defensive disconnect first).
   *
   * @returns {Promise<void>}
   */
  async connectApp() {
    // Defensive: disconnect if already connected
    try {
      await element(by.id('disconnectSession')).tap();
      await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
    } catch (_) {
      // Already disconnected — expected path
    }

    // Always write credentials to inputs (ensures correct session)
    await element(by.id('apiKeyInput')).replaceText(this.credentials.apiKey);
    await element(by.id('sessionIdInput')).replaceText(this.credentials.sessionId);
    await element(by.id('tokenInput')).replaceText(this.credentials.tokenApp);
    if (this.credentials.apiUrl) {
      await element(by.id('apiUrlInput')).replaceText(this.credentials.apiUrl);
    }
    await element(by.id('submitButton')).tap();
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(30000);
  }

  /**
   * Connects the app with explicit custom credentials.
   * Use this only for edge cases where you need credentials different
   * from what the TestSession was created with (e.g. subscriber-only token).
   *
   * @param {string} apiKey - Vonage Video API key
   * @param {string} sessionId - Session ID to connect to
   * @param {string} token - Authentication token for the app
   * @returns {Promise<void>}
   */
  async connectAppWithCredentials(apiKey, sessionId, token) {
    // Defensive: disconnect if already connected
    try {
      await element(by.id('disconnectSession')).tap();
      await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
    } catch (_) {
      // Already disconnected — expected path
    }

    await element(by.id('apiKeyInput')).replaceText(apiKey);
    await element(by.id('sessionIdInput')).replaceText(sessionId);
    await element(by.id('tokenInput')).replaceText(token);
    await element(by.id('submitButton')).tap();
    await waitFor(element(by.id('disconnectSession'))).toBeVisible().withTimeout(30000);
  }

  /**
   * Disconnects the app from the session.
   * Handles the case where the app is already disconnected.
   *
   * @returns {Promise<void>}
   */
  async disconnectApp() {
    try {
      await element(by.id('disconnectSession')).tap();
      await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
    } catch (_) {
      // Already disconnected or app is in a broken state
    }
  }

  /**
   * Full per-test cleanup: disconnect all active bots, disconnect app, clear events.
   * Returns bot browser instances to the pool for reuse.
   * Call in afterEach.
   *
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Disconnect all active bots and return to pool
    for (const bot of this.activeBots) {
      try {
        await bot.disconnect();
      } catch (_) {}
      this.botPool.push(bot);
    }
    this.activeBots = [];

    // Disconnect app
    await this.disconnectApp();

    // Clear event capture state
    try {
      await clearCapturedEvents();
    } catch (_) {}
  }

  /**
   * Final teardown: close all bot browsers (pool + active).
   * Call in afterAll.
   *
   * @returns {Promise<void>}
   */
  async teardown() {
    const allBots = [...this.activeBots, ...this.botPool];
    for (const bot of allBots) {
      try {
        await bot.close();
      } catch (_) {}
    }
    this.activeBots = [];
    this.botPool = [];
  }
}

module.exports = { TestSession };
