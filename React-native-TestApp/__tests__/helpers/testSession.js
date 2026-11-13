'use strict';

const { jsSDKTesterBot } = require('./jsSDKTesterBot');
const { clearCapturedEvents, getLastEvent } = require('./eventCapture');
const { withTimeout } = require('./timeout');
const { getCredentials } = require('./credentials');

/**
 * Session lifecycle for a spec: credentials, bots and app connection. Each bot gets its own
 * browser and is closed on cleanup. Factories: create (routed), createRelayed, createModeration.
 */
class TestSession {
  /**
   * @param {object} params
   * @param {object} params.credentials - Result of getCredentials(name)
   * @param {object} [params.botOptions={}] - Options passed to jsSDKTesterBot constructor
   */
  constructor({ credentials, botOptions = {} }) {
    this.credentials = credentials;
    this.botOptions = { timeout: 30000, ...botOptions };
    this.activeBots = [];
    this.botTokens = (credentials.botTokens || []).filter(Boolean);
  }

  static async create(botOptions = {}) {
    return new TestSession({ credentials: await getCredentials('routed'), botOptions });
  }

  static async createRelayed(botOptions = {}) {
    return new TestSession({ credentials: await getCredentials('relayed'), botOptions });
  }

  static async createModeration(botOptions = {}) {
    return new TestSession({ credentials: await getCredentials('moderation'), botOptions });
  }

  /**
   * Joins a bot to the session. Its token comes from the pool by the bot's position in activeBots.
   *
   * @param {jsSDKTesterBot} bot
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
   * Creates a fresh bot, joins it to the session and, by default, waits for the app to show the
   * subscriber view (which proves media is flowing).
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
   * Adds `count` bots; only the first waits for the subscriber view.
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
    // Tap outside the inputs to dismiss the keyboard; tapReturnKey has side effects
    // (autocomplete popups on Android, form submit on iOS).
    try {
      await element(by.id('mainScrollView')).tap({ x: 5, y: 5 });
    } catch (_) {}
    await element(by.id('submitButton')).tap();
    await this.waitForSessionConnected(30000);
  }

  /**
   * The disconnect button is shown even when the session fails, so poll the app's event counters
   * (flushed about once per second) and fail with the session error. A late error from the previous
   * session can arrive after the counters reset, so an error only fails once the session has had
   * `errorGraceMs` to connect.
   */
  async waitForSessionConnected(timeout, errorGraceMs = 5000) {
    const counter = async (id) => {
      try {
        const attrs = await element(by.id(id)).getAttributes();
        return Number(attrs.text || attrs.label || 0);
      } catch (_) {
        return 0;
      }
    };
    const start = Date.now();
    let errorSeenAt = null;
    while (Date.now() - start < timeout) {
      if ((await counter('session-sessionConnected')) > 0) return;
      if ((await counter('session-error')) > 0) {
        errorSeenAt = errorSeenAt || Date.now();
        if (Date.now() - errorSeenAt >= errorGraceMs) {
          const err = await getLastEvent('sessionError');
          const detail = err ? ` (code ${err.code}: ${err.message})` : '';
          throw new Error(`The app failed to connect to the session${detail}`);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`The app did not connect to the session within ${timeout}ms`);
  }

  async disconnectApp() {
    try {
      await element(by.id('disconnectSession')).tap();
      await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(5000);
    } catch (_) {}
  }

  /** Closes bots, disconnects the app and clears captured events. Every step is time-bounded. */
  async cleanup() {
    await this.teardown();
    await withTimeout(this.disconnectApp(), 15000, 'disconnectApp()');
    await withTimeout(clearCapturedEvents().catch(() => {}), 5000, 'clearCapturedEvents()');
  }

  /** Closes all bot browsers, each close time-bounded. Call in afterAll as a safety net. */
  async teardown() {
    const bots = this.activeBots;
    this.activeBots = [];
    for (const bot of bots) {
      await withTimeout(bot.close().catch(() => {}), 30000, 'bot.close()');
    }
  }
}

module.exports = { TestSession };
