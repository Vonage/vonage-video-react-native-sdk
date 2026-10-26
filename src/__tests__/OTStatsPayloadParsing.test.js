/**
 * Tests for cross-platform stats payload parsing and event dispatch.
 *
 * These tests verify the unification of Android/iOS stats event payloads,
 * including JSON serialization roundtrips, backward compatibility, and
 * the optional parsed stats convenience layer added by the JS wrappers.
 */

/**
 * Utility to parse and enrich native event payloads with parsed stats.
 * Mimics the behavior in OTSubscriberView.js and OTPublisher.js
 */
const withParsedJsonStats = (nativeEvent) => {
  if (!nativeEvent || typeof nativeEvent !== 'object') {
    return nativeEvent;
  }

  const { jsonStats } = nativeEvent;

  if (typeof jsonStats !== 'string' || jsonStats.length === 0) {
    return nativeEvent;
  }

  try {
    return {
      ...nativeEvent,
      stats: JSON.parse(jsonStats),
    };
  } catch {
    return nativeEvent;
  }
};

const getParsedStatsPayload = (nativeEvent) => {
  if (!nativeEvent || typeof nativeEvent !== 'object') {
    return nativeEvent;
  }

  const parseStatsString = (rawStats) => {
    if (typeof rawStats !== 'string' || rawStats.length === 0) {
      return undefined;
    }

    try {
      return JSON.parse(rawStats);
    } catch {
      return undefined;
    }
  };

  const parsedJsonStats = parseStatsString(nativeEvent.jsonStats);
  if (parsedJsonStats !== undefined) {
    return parsedJsonStats;
  }

  return nativeEvent.jsonStats ?? nativeEvent;
};

describe('Stats Payload Parsing (Cross-Platform Unification)', () => {
  describe('withParsedJsonStats - Subscriber/RTC events', () => {
    it('parses jsonStats string into stats object', () => {
      const statsData = {
        audioPacketsLost: 5,
        audioPacketsReceived: 100,
        timestamp: 1234567890,
      };

      const input = {
        jsonStats: JSON.stringify(statsData),
        stream: { streamId: 'test-stream-1' },
      };

      const result = withParsedJsonStats(input);

      expect(result.stats).toEqual(statsData);
      expect(result.stream).toEqual({ streamId: 'test-stream-1' });
      expect(result.jsonStats).toBe(input.jsonStats); // original preserved
    });

    it('ignores the removed jsonArrayOfReports key', () => {
      const input = {
        jsonArrayOfReports: JSON.stringify([{ audioPacketsLost: 5 }]),
        stream: { streamId: 'test-stream-2' },
      };

      const result = withParsedJsonStats(input);

      expect(result).toEqual(input);
      expect(result.stats).toBeUndefined();
    });

    it('returns unchanged event on malformed JSON in jsonStats', () => {
      const input = {
        jsonStats: 'not-valid-json{{{',
        stream: { streamId: 'test-stream-4' },
      };

      const result = withParsedJsonStats(input);

      expect(result).toEqual(input); // unchanged
      expect(result.stats).toBeUndefined();
    });

    it('returns unchanged event when jsonStats is missing', () => {
      const input = {
        stream: { streamId: 'test-stream-5' },
      };

      const result = withParsedJsonStats(input);

      expect(result).toEqual(input);
      expect(result.stats).toBeUndefined();
    });

    it('handles empty jsonStats string gracefully', () => {
      const input = {
        jsonStats: '',
        stream: { streamId: 'test-stream-6' },
      };

      const result = withParsedJsonStats(input);

      expect(result).toEqual(input); // unchanged
      expect(result.stats).toBeUndefined();
    });

    it('returns input unchanged for non-object types', () => {
      expect(withParsedJsonStats(null)).toBeNull();
      expect(withParsedJsonStats(undefined)).toBeUndefined();
      expect(withParsedJsonStats('string')).toBe('string');
      expect(withParsedJsonStats(42)).toBe(42);
    });
  });

  describe('getParsedStatsPayload - Publisher events', () => {
    it('parses jsonStats string into object', () => {
      const statsData = {
        audioBytesSent: 5000,
        audioPacketsSent: 50,
        timestamp: 1234567890,
      };

      const input = {
        jsonStats: JSON.stringify(statsData),
      };

      const result = getParsedStatsPayload(input);

      expect(result).toEqual(statsData);
    });

    it('ignores the removed legacy stats key', () => {
      const input = {
        stats: JSON.stringify({ audioBytesSent: 5000 }),
      };

      const result = getParsedStatsPayload(input);

      expect(result).toEqual(input);
    });

    it('returns input when no stats keys present', () => {
      const input = { someOtherKey: 'value' };

      const result = getParsedStatsPayload(input);

      expect(result).toEqual(input);
    });

    it('returns input unchanged for non-object types', () => {
      expect(getParsedStatsPayload(null)).toBeNull();
      expect(getParsedStatsPayload(undefined)).toBeUndefined();
      expect(getParsedStatsPayload('string')).toBe('string');
      expect(getParsedStatsPayload(42)).toBe(42);
    });

    it('returns the raw jsonStats string when it is malformed JSON', () => {
      const input = {
        jsonStats: '{invalid json}',
      };

      const result = getParsedStatsPayload(input);

      expect(result).toBe('{invalid json}');
    });
  });

  describe('Flat Payload Fields (deprecated, Android-only)', () => {
    it('keeps flat fields untouched and exposes the parsed stats', () => {
      const nativePayload = {
        jsonStats: JSON.stringify({
          audioPacketsLost: 5,
          audioPacketsReceived: 100,
          audioBytesReceived: 2048,
          timestamp: 1234567890,
        }),
        stream: { streamId: 'audio-sub' },
        audioPacketsLost: 5,
        audioPacketsReceived: 100,
        audioBytesReceived: 2048,
        timestamp: 1234567890,
      };

      const enriched = withParsedJsonStats(nativePayload);

      expect(enriched.stats.timestamp).toBe(1234567890);
      expect(enriched.stats.startTime).toBeUndefined();
      expect(enriched.timestamp).toBe(1234567890);
    });
  });

  describe('Event Dispatch Scenarios', () => {
    it('audioNetworkStats callback receives enriched payload with parsed stats', () => {
      const mockCallback = jest.fn();

      const nativeEvent = {
        jsonStats: JSON.stringify({
          audioPacketsLost: 5,
          audioPacketsReceived: 100,
          timestamp: 1234567890,
        }),
        stream: { streamId: 'subscriber-audio' },
      };

      // Simulate event handler dispatch
      const enriched = withParsedJsonStats(nativeEvent);
      mockCallback(enriched);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stats: expect.objectContaining({
            audioPacketsLost: 5,
            audioPacketsReceived: 100,
          }),
        })
      );
    });

    it('rtcStatsReport callback receives jsonStats and parsed stats', () => {
      const mockCallback = jest.fn();

      const nativeEvent = {
        jsonStats: JSON.stringify([{ audioPacketsLost: 5 }]),
        stream: { streamId: 'rtc-stream' },
      };

      const enriched = withParsedJsonStats(nativeEvent);
      mockCallback(enriched);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonStats: expect.any(String),
          stats: expect.any(Array),
        })
      );
    });
  });

  describe('Type Safety - Optional timestamp field', () => {
    it('accepts payload without timestamp (optional)', () => {
      const incompletePayload = {
        audioPacketsLost: 5,
        audioPacketsReceived: 100,
        audioBytesReceived: 2048,
        // timestamp is missing - should still be valid
      };

      // Should not throw
      expect(() => {
        withParsedJsonStats({
          jsonStats: JSON.stringify(incompletePayload),
          stream: { streamId: 'test' },
        });
      }).not.toThrow();
    });

    it('accepts payload with timestamp (provided)', () => {
      const completePayload = {
        audioPacketsLost: 5,
        audioPacketsReceived: 100,
        audioBytesReceived: 2048,
        timestamp: 1234567890,
      };

      expect(() => {
        withParsedJsonStats({
          jsonStats: JSON.stringify(completePayload),
          stream: { streamId: 'test' },
        });
      }).not.toThrow();
    });

  });
});
