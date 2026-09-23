// axios is called as a function (axios({ url, method, data })) inside logRequest.
// Mock it as a resolved-promise-returning function so no real network call is made.
jest.mock('axios', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve({})),
}));

// Pin package info so log payload assertions are stable across version bumps.
jest.mock('../generated/packageInfo', () => ({
  OTRN_PACKAGE_INFO: {
    name: '@vonage/client-sdk-video-react-native',
    version: '9.9.9-test',
    repositoryUrl: 'https://example.test/repo.git',
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: '17.0' },
}));

import axios from 'axios';
import {
  sanitizeBooleanProperty,
  getOtrnErrorEventHandler,
  logOT,
} from '../helpers/OTHelper';

describe('OTHelper', () => {
  describe('sanitizeBooleanProperty', () => {
    it('returns true for undefined (opt-in-by-default semantics)', () => {
      expect(sanitizeBooleanProperty(undefined)).toBe(true);
    });

    it('returns true for true', () => {
      expect(sanitizeBooleanProperty(true)).toBe(true);
    });

    it('returns false for false', () => {
      expect(sanitizeBooleanProperty(false)).toBe(false);
    });

    // Documents the current behavior: the guard is `property || property === undefined`,
    // so any truthy value collapses to `true` (the raw value is not preserved).
    it('returns true for a truthy non-boolean', () => {
      expect(sanitizeBooleanProperty('yes')).toBe(true);
      expect(sanitizeBooleanProperty(1)).toBe(true);
    });

    // Falsy-but-defined values fail both sides of the guard and fall through,
    // so the raw value is returned as-is.
    it('returns the falsy value itself for a falsy non-boolean (not undefined)', () => {
      expect(sanitizeBooleanProperty(0)).toBe(0);
      expect(sanitizeBooleanProperty(null)).toBeNull();
      expect(sanitizeBooleanProperty('')).toBe('');
    });
  });

  describe('getOtrnErrorEventHandler', () => {
    it('returns the provided otrnError handler when present', () => {
      const handler = jest.fn();
      const resolved = getOtrnErrorEventHandler({ otrnError: handler });
      expect(resolved).toBe(handler);
    });

    it('returns a default handler when events is not an object', () => {
      const resolved = getOtrnErrorEventHandler(undefined);
      expect(typeof resolved).toBe('function');
      // The default handler should be callable without throwing.
      expect(() => resolved('some-error')).not.toThrow();
    });

    it('returns a default handler when events lacks otrnError', () => {
      const resolved = getOtrnErrorEventHandler({ somethingElse: jest.fn() });
      expect(typeof resolved).toBe('function');
      expect(() => resolved('some-error')).not.toThrow();
    });
  });

  describe('logOT', () => {
    it('posts a log event to the default hlg URL when no proxy is given', () => {
      logOT({
        apiKey: 'key-1',
        sessionId: 'session-1',
        action: 'rn_initialize',
      });

      expect(axios).toHaveBeenCalledTimes(1);
      const request = axios.mock.calls[0][0];
      expect(request.method).toBe('post');
      expect(request.url).toBe(
        'https://hlg.tokbox.com/prod/logging/ClientEvent'
      );
    });

    it('routes through the proxy URL when provided', () => {
      logOT({
        apiKey: 'key-1',
        sessionId: 'session-1',
        action: 'rn_initialize',
        proxyUrl: 'https://proxy.example.test',
      });

      const request = axios.mock.calls[0][0];
      expect(request.url).toBe(
        'https://proxy.example.test/hlg.tokbox.com/prod/logging/ClientEvent'
      );
    });

    it('builds the expected log payload shape', () => {
      logOT({
        apiKey: 'partner-42',
        sessionId: 'session-abc',
        action: 'rn_initialize',
      });

      const { data } = axios.mock.calls[0][0];
      expect(data).toMatchObject({
        payload_type: 'info',
        action: 'rn_initialize',
        partner_id: 'partner-42',
        session_id: 'session-abc',
        source: 'https://example.test/repo.git',
        payload: {
          platform: 'ios',
          otrn_version: '9.9.9-test',
          platform_version: '17.0',
        },
      });
    });

    it('includes connectionId only when provided', () => {
      logOT({
        apiKey: 'key-1',
        sessionId: 'session-1',
        action: 'rn_initialize',
        connectionId: 'conn-9',
      });
      expect(axios.mock.calls[0][0].data.connectionId).toBe('conn-9');

      axios.mockClear();

      logOT({
        apiKey: 'key-1',
        sessionId: 'session-1',
        action: 'rn_initialize',
      });
      expect(axios.mock.calls[0][0].data.connectionId).toBeUndefined();
    });
  });
});
