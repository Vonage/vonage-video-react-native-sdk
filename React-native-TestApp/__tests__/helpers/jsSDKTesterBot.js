'use strict';

const { chromium } = require('playwright');
const { withTimeout } = require('./timeout');

/**
 * Headless Chromium bot that joins a session as a remote participant through the OpenTok JS SDK,
 * controlled from the Jest process. Several bots can run at once for multi-party scenarios.
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

  /** Launches headless Chromium with fake media devices. Call it before joinSession(). */
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

    // getUserMedia needs a secure origin
    await this.page.route('https://localhost/bot', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body></body></html>',
      });
    });
    await this.page.goto('https://localhost/bot');

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
   * Joins a session and publishes a stream.
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

    await this.page.waitForFunction(
      () => window.botState.connected && window.botState.publishing,
      { timeout: this.options.timeout }
    );
  }

  /** Current `window.botState`. */
  async getState() {
    return this.page.evaluate(() => window.botState);
  }

  /** Audio/video state of the bot's own published stream. */
  async getPublisherState() {
    return this.page.evaluate(() => {
      const stream = window.botPublisher && window.botPublisher.stream;
      return {
        hasAudio: stream ? stream.hasAudio : null,
        hasVideo: stream ? stream.hasVideo : null,
      };
    });
  }

  /** streamId of the bot's own published stream, or null. */
  async getPublisherStreamId() {
    return this.page.evaluate(() => {
      const stream = window.botPublisher && window.botPublisher.stream;
      return stream ? stream.streamId : null;
    });
  }

  /** connectionId of the bot's session connection, or null. */
  async getConnectionId() {
    return this.page.evaluate(() =>
      window.botSession && window.botSession.connection
        ? window.botSession.connection.connectionId
        : null
    );
  }

  /** Force-unpublishes another participant's stream (needs a moderator token). */
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
   * Waits until `predicate(arg)` holds inside the bot's page. It runs in the browser, so there is
   * no round trip per poll, and the timeout error names `label`.
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

  /** Waits for a specific remote stream, or for any subscribed stream when no `streamId` is given. */
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
   * Number of remote streams seen so far. Take it before an action and pass it to
   * `waitForNewStream` to wait for a stream created after that point.
   */
  async getStreamCount() {
    return this.page.evaluate(() => window.botState.streamCreatedCount);
  }

  /** Waits for a remote stream created after `previousCount` (see `getStreamCount`). */
  async waitForNewStream(previousCount, timeout) {
    await this.waitForCondition(
      (count) => window.botState.streamCreatedCount > count,
      previousCount,
      'a new remote stream',
      timeout
    );
  }

  /** `{ streamId, hasAudio, hasVideo, videoType }` of every stream in the session except the bot's own. */
  async getRemoteStreams() {
    return this.page.evaluate(() => {
      const ownConnectionId = window.botSession.connection && window.botSession.connection.connectionId;
      const result = [];
      window.botSession.streams.forEach((stream) => {
        if (stream.connection && stream.connection.connectionId === ownConnectionId) return;
        result.push({
          streamId: stream.streamId,
          hasAudio: stream.hasAudio,
          hasVideo: stream.hasVideo,
          videoType: stream.videoType,
        });
      });
      return result;
    });
  }

  /**
   * Waits until the session holds a remote stream matching `{ videoType, hasAudio, hasVideo }`
   * (any field left undefined is ignored) and returns it.
   */
  async waitForRemoteStream(match, timeout = 30000) {
    await this.waitForCondition(
      (m) => {
        const own = window.botSession.connection && window.botSession.connection.connectionId;
        let found = false;
        window.botSession.streams.forEach((s) => {
          if (s.connection && s.connection.connectionId === own) return;
          if (m.videoType !== undefined && s.videoType !== m.videoType) return;
          if (m.hasAudio !== undefined && s.hasAudio !== m.hasAudio) return;
          if (m.hasVideo !== undefined && s.hasVideo !== m.hasVideo) return;
          found = true;
        });
        return found;
      },
      match,
      `a remote stream matching ${JSON.stringify(match)}`,
      timeout
    );
  }

  /** Waits until the session holds no remote stream of the given `videoType`. */
  async waitForNoRemoteStream(videoType, timeout = 15000) {
    await this.waitForCondition(
      (type) => {
        const own = window.botSession.connection && window.botSession.connection.connectionId;
        let found = false;
        window.botSession.streams.forEach((s) => {
          if (s.connection && s.connection.connectionId === own) return;
          if (s.videoType === type) found = true;
        });
        return !found;
      },
      videoType,
      `no remote ${videoType} stream`,
      timeout
    );
  }

  /** Waits for the bot's own stream to have (or lose) audio, e.g. after a force mute. */
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

  /** Waits for the bot to leave the session, e.g. after a force disconnect. */
  async waitForDisconnected(timeout = 15000) {
    await this.waitForCondition(
      () => !window.botState.connected,
      undefined,
      'the bot to be disconnected',
      timeout
    );
  }

  /** Turns the bot's outbound video on or off. */
  async setPublishVideo(on) {
    await this.page.evaluate((value) => {
      if (window.botPublisher) window.botPublisher.publishVideo(value);
    }, on);
  }

  /** Turns the bot's outbound audio on or off. */
  async setPublishAudio(on) {
    await this.page.evaluate((value) => {
      if (window.botPublisher) window.botPublisher.publishAudio(value);
    }, on);
  }

  /** Leaves the session without closing the browser; joinSession() can be called again. */
  async disconnect() {
    if (this.page) {
      await this.page.evaluate(() => {
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
      try {
        await this.page.waitForFunction(
          () => !window.botState.connected,
          { timeout: 5000 }
        );
      } catch (_) {
        // The bot may already be disconnected
      }
    }
  }

  /** Leaves the session and closes the browser. */
  async close() {
    try {
      await withTimeout(this.disconnect(), 15000, 'bot disconnect()');
    } catch (e) {
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
