'use strict';

const { chromium } = require('playwright');
const { withTimeout } = require('./timeout');

/**
 * jsSDKTesterBot - A headless Chromium-based bot that joins a Vonage Video session
 * as a remote participant using the OpenTok JS SDK.
 *
 * Used in e2e tests to simulate remote participants that publish streams,
 * send signals, and receive media — all controlled from the Jest test process.
 *
 * Multiple instances can run simultaneously to test multi-party scenarios
 * (e.g. relayed → routed transitions with 3+ participants).
 */
class jsSDKTesterBot {
  constructor(options = {}) {
    this.browser = null;
    this.page = null;
    this.options = {
      headless: true,
      timeout: 20000,
      ...options,
    };
  }

  /**
   * Launches headless Chromium with fake media devices.
   * Must be called before joinSession().
   */
  async launch() {
    this.browser = await chromium.launch({
      headless: this.options.headless,
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-web-security',
        '--disable-features=WebRtcHideLocalIpsWithMdns',
        '--allow-running-insecure-content',
      ],
    });

    const context = await this.browser.newContext({
      permissions: ['camera', 'microphone'],
      ignoreHTTPSErrors: true,
      baseURL: 'https://localhost',
    });

    this.page = await context.newPage();

    // Navigate to a fake HTTPS page first so getUserMedia works
    await this.page.route('https://localhost/bot', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body></body></html>',
      });
    });
    await this.page.goto('https://localhost/bot');

    // Log page errors and console for debugging
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.warn('[jsSDKTesterBot] Console error:', msg.text());
      }
    });
    this.page.on('pageerror', (err) => {
      console.warn('[jsSDKTesterBot] Page error:', err.message);
    });
  }

  /**
   * Joins a Vonage Video session and publishes a stream.
   *
   * @param {string} apiKey - Vonage Video API key
   * @param {string} sessionId - Session ID to join
   * @param {string} token - Authentication token for the bot
   * @param {object} [options] - Optional configuration
   * @param {string} [options.apiUrl] - API URL (for non-production environments)
   * @param {string} [options.jsSdkUrl] - JS SDK URL (overrides env var and default CDN)
   * @param {object} [options.publisherOptions] - OT.initPublisher options
   */
  async joinSession(apiKey, sessionId, token, options = {}) {
    if (!this.page) {
      throw new Error('jsSDKTesterBot: call launch() before joinSession()');
    }

    // Navigate to fresh page to clear any previous session state
    await this.page.goto('https://localhost/bot');

    const { apiUrl, jsSdkUrl, publisherOptions = {} } = options;

    const pubOpts = JSON.stringify({
      videoSource: true,
      audioSource: true,
      width: 320,
      height: 240,
      name: 'bot-publisher',
      ...publisherOptions,
    });

    // JS SDK URL resolution: options.jsSdkUrl → env var → default
    const sdkUrl = jsSdkUrl
      || process.env.E2E_JS_SDK_URL
      || 'https://static.opentok.com/v2/js/opentok.min.js';

    await this.page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <script src="${sdkUrl}"></script>
      </head>
      <body>
        <div id="videos"></div>
        <script>
          window.botState = {
            connected: false,
            publishing: false,
            subscriberCount: 0,
            error: null,
            streamCreatedCount: 0,
          };

          const session = OT.initSession('${apiKey}', '${sessionId}'${apiUrl ? `, { apiUrl: '${apiUrl}' }` : ''});

          session.on('streamCreated', (event) => {
            if (!window.botState.connected) return;
            session.subscribe(event.stream, 'videos', { insertMode: 'append' });
            window.botState.subscriberCount++;
            window.botState.streamCreatedCount++;
          });

          session.on('streamDestroyed', () => {
            window.botState.subscriberCount = Math.max(0, window.botState.subscriberCount - 1);
          });

          session.on('sessionDisconnected', () => {
            window.botState.connected = false;
            window.botState.publishing = false;
          });

          session.connect('${token}', (err) => {
            if (err) {
              window.botState.error = err.message;
              return;
            }
            window.botState.connected = true;

            const publisher = OT.initPublisher('videos', ${pubOpts});
            window.botPublisher = publisher;

            publisher.on('streamCreated', () => {
              window.botState.publishing = true;
            });

            publisher.on('streamDestroyed', () => {
              window.botState.publishing = false;
            });

            session.publish(publisher, (pubErr) => {
              if (pubErr) {
                window.botState.error = pubErr.message;
              }
            });
          });

          window.botSession = session;
        </script>
      </body>
      </html>
    `);

    // Wait for the bot to be connected and publishing
    await this.page.waitForFunction(
      () => window.botState.connected && window.botState.publishing,
      { timeout: this.options.timeout }
    );
  }

  /**
   * Returns the current bot state.
   * @returns {Promise<{connected: boolean, publishing: boolean, subscriberCount: number, error: string|null, streamCreatedCount: number}>}
   */
  async getState() {
    return this.page.evaluate(() => window.botState);
  }

  /**
   * Returns the audio/video state of the bot's own published stream.
   * @returns {Promise<{hasAudio: boolean|null, hasVideo: boolean|null}>}
   */
  async getPublisherState() {
    return this.page.evaluate(() => {
      const stream = window.botPublisher && window.botPublisher.stream;
      return {
        hasAudio: stream ? stream.hasAudio : null,
        hasVideo: stream ? stream.hasVideo : null,
      };
    });
  }

  /**
   * Returns the streamId of the bot's own published stream, or null.
   * @returns {Promise<string|null>}
   */
  async getPublisherStreamId() {
    return this.page.evaluate(() => {
      const stream = window.botPublisher && window.botPublisher.stream;
      return stream ? stream.streamId : null;
    });
  }

  /**
   * Returns the connectionId of the bot's session connection, or null.
   * @returns {Promise<string|null>}
   */
  async getConnectionId() {
    return this.page.evaluate(() =>
      window.botSession && window.botSession.connection
        ? window.botSession.connection.connectionId
        : null
    );
  }

  /**
   * Force-unpublishes another participant's stream (requires a moderator token).
   * @param {string} streamId - Stream to unpublish
   */
  async forceUnpublish(streamId) {
    await this.page.evaluate(
      (id) =>
        new Promise((resolve, reject) => {
          const stream = window.botSession.streams.get(id);
          if (!stream) {
            reject(new Error(`Stream ${id} not found in bot session`));
            return;
          }
          window.botSession.forceUnpublish(stream, (err) => (err ? reject(err) : resolve()));
        }),
      streamId
    );
  }

  /**
   * Waits until a condition holds inside the bot's page. The check runs in the browser, so it does
   * not cost a round trip per poll. Fails with a message that names the condition.
   *
   * @param {Function} predicate - Runs in the page; receives `arg`
   * @param {*} arg - Serializable argument passed to the predicate
   * @param {string} label - What is being waited for, used in the timeout error
   * @param {number} [timeout] - Max wait time in ms (defaults to constructor timeout)
   */
  async waitForCondition(predicate, arg, label, timeout) {
    const ms = timeout || this.options.timeout;
    try {
      await this.page.waitForFunction(predicate, arg, { timeout: ms });
    } catch (e) {
      if (e.name !== 'TimeoutError') throw e;
      throw new Error(`Timed out after ${ms}ms waiting for ${label}`);
    }
  }

  /**
   * Waits for a remote stream: a specific one when `streamId` is given, otherwise any stream the
   * bot is subscribed to.
   *
   * @param {object} [options]
   * @param {string} [options.streamId]
   * @param {number} [options.timeout]
   */
  async waitForStream({ streamId, timeout } = {}) {
    if (streamId) {
      await this.waitForCondition(
        (id) => !!(window.botSession && window.botSession.streams.get(id)),
        streamId,
        `stream ${streamId}`,
        timeout
      );
      return;
    }
    await this.waitForCondition(
      () => window.botState.subscriberCount > 0,
      undefined,
      'a remote stream',
      timeout
    );
  }

  /**
   * Returns how many remote streams the bot has seen created so far. Take it before an action,
   * then pass it to `waitForNewStream` to wait for a stream created after that point.
   *
   * @returns {Promise<number>}
   */
  async getStreamCount() {
    return this.page.evaluate(() => window.botState.streamCreatedCount);
  }

  /**
   * Waits for a remote stream created after `previousCount` (see `getStreamCount`).
   *
   * @param {number} previousCount
   * @param {number} [timeout]
   */
  async waitForNewStream(previousCount, timeout) {
    await this.waitForCondition(
      (count) => window.botState.streamCreatedCount > count,
      previousCount,
      'a new remote stream',
      timeout
    );
  }

  /**
   * Waits until the bot's own published stream has (or lacks) audio, for example after a mute.
   *
   * @param {boolean} expected
   * @param {number} [timeout]
   */
  async waitForPublisherAudio(expected, timeout = 15000) {
    await this.waitForCondition(
      (value) => {
        const stream = window.botPublisher && window.botPublisher.stream;
        return !!stream && stream.hasAudio === value;
      },
      expected,
      `bot published stream hasAudio=${expected}`,
      timeout
    );
  }

  /**
   * Waits until the bot's session is disconnected, for example after a force disconnect.
   *
   * @param {number} [timeout]
   */
  async waitForDisconnected(timeout = 15000) {
    await this.waitForCondition(
      () => !window.botState.connected,
      undefined,
      'the bot to be disconnected',
      timeout
    );
  }

  /**
   * Toggles the bot's outbound video (camera) on its publisher.
   * @param {boolean} on
   */
  async setPublishVideo(on) {
    await this.page.evaluate((value) => {
      if (window.botPublisher) window.botPublisher.publishVideo(value);
    }, on);
  }

  /**
   * Toggles the bot's outbound audio (mic) on its publisher.
   * @param {boolean} on
   */
  async setPublishAudio(on) {
    await this.page.evaluate((value) => {
      if (window.botPublisher) window.botPublisher.publishAudio(value);
    }, on);
  }

  /**
   * Repeatedly toggles the bot's camera off/on. The loop runs inside a single
   * page.evaluate so timing is at browser speed, not gated by the CDP round-trip.
   * @param {number} iterations - off→on cycles
   * @param {number} [intervalMs=100]
   */
  async churnVideo(iterations, intervalMs = 100) {
    await this.page.evaluate(
      async ({ iterations, intervalMs }) => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        for (let i = 0; i < iterations; i++) {
          if (!window.botPublisher) break;
          window.botPublisher.publishVideo(false);
          await sleep(intervalMs);
          if (!window.botPublisher) break;
          window.botPublisher.publishVideo(true);
          await sleep(intervalMs);
        }
      },
      { iterations, intervalMs }
    );
  }

  /**
   * Disconnects the bot from the session without closing the browser.
   * Unpublishes first to avoid "cannot publish" errors during teardown,
   * then waits for sessionDisconnected to confirm disconnect is complete.
   * Can call joinSession() again after this.
   */
  async disconnect() {
    if (this.page) {
      await this.page.evaluate(() => {
        // Unpublish first to stop the publisher cleanly
        if (window.botPublisher && window.botSession) {
          try {
            window.botSession.unpublish(window.botPublisher);
            window.botPublisher.destroy();
          } catch (_) {}
          window.botPublisher = null;
        }
        if (window.botSession) {
          window.botSession.disconnect();
        }
      });
      // Wait for disconnect to complete (sessionDisconnected sets connected=false)
      try {
        await this.page.waitForFunction(
          () => !window.botState.connected,
          { timeout: 5000 }
        );
      } catch (_) {
        // Timeout is acceptable — bot may already be disconnected
      }
    }
  }

  /**
   * Disconnects and closes the browser entirely.
   * Call this in afterAll().
   */
  async close() {
    try {
      await withTimeout(this.disconnect(), 15000, 'bot disconnect()');
    } catch (e) {
      // Ignore errors during cleanup
    }
    if (this.browser) {
      const browser = this.browser;
      this.browser = null;
      this.page = null;
      await withTimeout(browser.close().catch(() => {}), 15000, 'bot browser.close()');
    }
  }
}

module.exports = { jsSDKTesterBot };
