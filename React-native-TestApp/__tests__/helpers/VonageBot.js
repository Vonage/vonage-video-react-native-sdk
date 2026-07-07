'use strict';

const { chromium } = require('playwright');

/**
 * VonageBot - A headless Chromium-based bot that joins a Vonage Video session
 * as a second participant using the Vonage Video JS SDK.
 *
 * Used in e2e tests to simulate a remote participant that publishes streams,
 * sends signals, and receives media — all controlled from the Jest test process.
 */
class VonageBot {
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
        console.warn('[VonageBot] Console error:', msg.text());
      }
    });
    this.page.on('pageerror', (err) => {
      console.warn('[VonageBot] Page error:', err.message);
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
   * @param {object} [options.publisherOptions] - OT.initPublisher options
   */
  async joinSession(apiKey, sessionId, token, options = {}) {
    if (!this.page) {
      throw new Error('VonageBot: call launch() before joinSession()');
    }

    const { apiUrl, publisherOptions = {} } = options;

    const pubOpts = JSON.stringify({
      videoSource: true,
      audioSource: true,
      width: 320,
      height: 240,
      name: 'bot-publisher',
      ...publisherOptions,
    });

    const sdkUrl = apiUrl && apiUrl.includes('dev')
      ? 'https://static.dev.tokbox.com/v2/js/opentok.js'
      : 'https://static.opentok.com/v2/js/opentok.min.js';

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
            lastSignal: null,
            muteForced: false,
            streamCreated: false,
          };

          const session = OT.initSession('${apiKey}', '${sessionId}');

          session.on('streamCreated', (event) => {
            session.subscribe(event.stream, 'videos', { insertMode: 'append' });
            window.botState.subscriberCount++;
            window.botState.streamCreated = true;
          });

          session.on('streamDestroyed', () => {
            window.botState.subscriberCount = Math.max(0, window.botState.subscriberCount - 1);
          });

          session.on('signal', (event) => {
            window.botState.lastSignal = { type: event.type, data: event.data };
          });

          session.on('muteForced', () => {
            window.botState.muteForced = true;
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
   * @returns {Promise<{connected: boolean, publishing: boolean, subscriberCount: number, error: string|null, lastSignal: object|null, muteForced: boolean, streamCreated: boolean}>}
   */
  async getState() {
    return this.page.evaluate(() => window.botState);
  }

  /**
   * Waits until the bot receives at least one stream from a remote participant.
   * @param {number} [timeout] - Max wait time in ms (defaults to constructor timeout)
   */
  async waitForSubscriber(timeout) {
    await this.page.waitForFunction(
      () => window.botState.subscriberCount > 0,
      { timeout: timeout || this.options.timeout }
    );
  }

  /**
   * Sends a signal to the session.
   * @param {string} type - Signal type
   * @param {string} data - Signal data
   */
  async sendSignal(type, data) {
    await this.page.evaluate(
      ({ type, data }) => {
        return new Promise((resolve, reject) => {
          window.botSession.signal({ type, data }, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      },
      { type, data }
    );
  }

  /**
   * Disconnects the bot from the session without closing the browser.
   * Can call joinSession() again after this.
   */
  async disconnect() {
    if (this.page) {
      await this.page.evaluate(() => {
        if (window.botSession) {
          window.botSession.disconnect();
        }
      });
    }
  }

  /**
   * Disconnects and closes the browser entirely.
   * Call this in afterAll().
   */
  async close() {
    try {
      await this.disconnect();
    } catch (e) {
      // Ignore errors during cleanup
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

module.exports = { VonageBot };
