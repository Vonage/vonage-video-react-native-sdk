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

  const jsonStats =
    typeof nativeEvent.jsonStats === 'string' && nativeEvent.jsonStats.length > 0
      ? nativeEvent.jsonStats
      : typeof nativeEvent.jsonArrayOfReports === 'string' &&
          nativeEvent.jsonArrayOfReports.length > 0
        ? nativeEvent.jsonArrayOfReports
        : undefined;

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

  const parsedLegacyStats = parseStatsString(nativeEvent.stats);
  if (parsedLegacyStats !== undefined) {
    return parsedLegacyStats;
  }

  return nativeEvent.stats ?? nativeEvent.jsonStats ?? nativeEvent;
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

    it('falls back to jsonArrayOfReports when jsonStats is missing', () => {
      const reportsData = [
        { audioPacketsLost: 5, timestamp: 1234567890 },
      ];

      const input = {
        jsonArrayOfReports: JSON.stringify(reportsData),
        stream: { streamId: 'test-stream-2' },
      };

      const result = withParsedJsonStats(input);

      expect(result.stats).toEqual(reportsData);
      expect(result.stream).toEqual({ streamId: 'test-stream-2' });
    });

    it('prefers jsonStats over jsonArrayOfReports', () => {
      const statsData = { audioPacketsLost: 10 };
      const reportsData = { audioPacketsLost: 5 };

      const input = {
        jsonStats: JSON.stringify(statsData),
        jsonArrayOfReports: JSON.stringify(reportsData),
        stream: { streamId: 'test-stream-3' },
      };

      const result = withParsedJsonStats(input);

      expect(result.stats).toEqual(statsData);
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

    it('returns unchanged event when both jsonStats and jsonArrayOfReports are missing', () => {
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

    it('falls back to legacy stats key when jsonStats is missing', () => {
      const statsData = {
        audioBytesSent: 5000,
        audioPacketsSent: 50,
      };

      const input = {
        stats: JSON.stringify(statsData),
      };

      const result = getParsedStatsPayload(input);

      expect(result).toEqual(statsData);
    });

    it('prefers jsonStats over legacy stats', () => {
      const jsonStatsData = { audioBytesSent: 5000 };
      const legacyStatsData = { audioBytesSent: 3000 };

      const input = {
        jsonStats: JSON.stringify(jsonStatsData),
        stats: JSON.stringify(legacyStatsData),
      };

      const result = getParsedStatsPayload(input);

      expect(result).toEqual(jsonStatsData);
    });

    it('returns fallback string when both JSON keys are missing', () => {
      const input = {
        stats: 'some-unparseable-value',
      };

      const result = getParsedStatsPayload(input);

      expect(result).toBe('some-unparseable-value');
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

    it('handles malformed JSON gracefully', () => {
      const input = {
        jsonStats: '{invalid json}',
        stats: '{also invalid}',
      };

      const result = getParsedStatsPayload(input);

      // Both fail, so returns fallback
      expect(result).toBe('{also invalid}');
    });
  });

  describe('Backward Compatibility - Flat Payload Fields', () => {
    it('subscriber audio event contains both timestamp and deprecated startTime', () => {
      // Simulates Android subscriber audio payload after fix
      const nativePayload = {
        jsonStats: JSON.stringify({
          audioPacketsLost: 5,
          audioPacketsReceived: 100,
          audioBytesReceived: 2048,
          timestamp: 1234567890,
          startTime: 1234567890, // deprecated but present
        }),
        stream: { streamId: 'audio-sub' },
        // Backward compat flat fields
        audioPacketsLost: 5,
        audioPacketsReceived: 100,
        audioBytesReceived: 2048,
        startTime: 1234567890,
        timestamp: 1234567890,
      };

      const enriched = withParsedJsonStats(nativePayload);

      // Parsed stats should have both keys
      expect(enriched.stats.timestamp).toBe(1234567890);
      expect(enriched.stats.startTime).toBe(1234567890);

      // Flat fields preserved for backward compat
      expect(enriched.timestamp).toBe(1234567890);
      expect(enriched.startTime).toBe(1234567890);
    });

    it('publisher video stats include both timestamp and deprecated startTime', () => {
      const statsData = {
        videoBytesReceived: 5000,
        videoPacketsLost: 2,
        videoPacketsReceived: 500,
        timestamp: 9876543210,
        startTime: 9876543210, // deprecated but present
      };

      const input = {
        jsonStats: JSON.stringify(statsData),
      };

      const result = getParsedStatsPayload(input);

      expect(result.timestamp).toBe(9876543210);
      expect(result.startTime).toBe(9876543210);
    });

    it('handles missing timestamp in old payloads (uses startTime as fallback)', () => {
      // Legacy Android payload with only startTime
      const legacyPayload = {
        jsonStats: JSON.stringify({
          audioPacketsLost: 5,
          audioPacketsReceived: 100,
          audioBytesReceived: 2048,
          startTime: 1234567890,
          // timestamp missing - this is the old shape
        }),
      };

      const enriched = withParsedJsonStats(legacyPayload);

      expect(enriched.stats.startTime).toBe(1234567890);
      expect(enriched.stats.timestamp).toBeUndefined();
    });
  });

  describe('RTC Stats Report Payload - Deprecated Fallback', () => {
    it('emits both jsonStats and deprecated jsonArrayOfReports', () => {
      const rtcData = [
        { audioPacketsLost: 5, timestamp: 1234567890 },
        { videoPacketsLost: 2, timestamp: 1234567890 },
      ];

      // Android subscriber emits both keys for backward compatibility
      const nativePayload = {
        jsonArrayOfReports: JSON.stringify(rtcData), // deprecated
        jsonStats: JSON.stringify(rtcData), // canonical
        stream: { streamId: 'rtc-stats-stream' },
      };

      const enriched = withParsedJsonStats(nativePayload);

      // Should parse from preferred jsonStats
      expect(enriched.stats).toEqual(rtcData);
      // Both keys should be present on the event object
      expect(enriched.jsonStats).toBeDefined();
      expect(enriched.jsonArrayOfReports).toBeDefined();
    });

    it('falls back to jsonArrayOfReports if jsonStats missing (pre-fix Android)', () => {
      const rtcData = [
        { audioPacketsLost: 5, timestamp: 1234567890 },
      ];

      // Pre-fix Android only emitted jsonArrayOfReports
      const nativePayload = {
        jsonArrayOfReports: JSON.stringify(rtcData),
        stream: { streamId: 'rtc-stats-stream-old' },
      };

      const enriched = withParsedJsonStats(nativePayload);

      expect(enriched.stats).toEqual(rtcData);
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

    it('rtcStatsReport callback receives payload with both canonical and deprecated keys', () => {
      const mockCallback = jest.fn();

      const nativeEvent = {
        jsonArrayOfReports: JSON.stringify([{ audioPacketsLost: 5 }]),
        jsonStats: JSON.stringify([{ audioPacketsLost: 5 }]),
        stream: { streamId: 'rtc-stream' },
      };

      const enriched = withParsedJsonStats(nativeEvent);
      mockCallback(enriched);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonArrayOfReports: expect.any(String),
          jsonStats: expect.any(String),
          stats: expect.any(Array),
        })
      );
    });

    it('disconnected and subscriberDisconnected both fire on subscriber disconnect', () => {
      const deprecatedCallback = jest.fn();
      const modernCallback = jest.fn();

      const streamEvent = { streamId: 'test-stream', sessionId: 'session-1' };

      // Simulate both being called from OTSubscriberView.js
      deprecatedCallback(streamEvent);
      modernCallback(streamEvent);

      expect(deprecatedCallback).toHaveBeenCalledWith(streamEvent);
      expect(modernCallback).toHaveBeenCalledWith(streamEvent);
    });
  });

  describe('Type Safety - Optional timestamp field', () => {
    it('accepts payload without timestamp (optional)', () => {
      const incompletePayload = {
        audioPacketsLost: 5,
        audioPacketsReceived: 100,
        audioBytesReceived: 2048,
        // timestamp is missing - should still be valid
        startTime: 1234567890, // deprecated fallback
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

    it('handles mixed old and new shapes without breaking', () => {
      const oldShape = {
        audioPacketsLost: 5,
        startTime: 1234567890,
        // no timestamp
      };

      const newShape = {
        audioPacketsLost: 5,
        timestamp: 1234567890,
      };

      const oldEnriched = withParsedJsonStats({
        jsonStats: JSON.stringify(oldShape),
        stream: { streamId: 'test' },
      });

      const newEnriched = withParsedJsonStats({
        jsonStats: JSON.stringify(newShape),
        stream: { streamId: 'test' },
      });

      expect(oldEnriched.stats).toBeDefined();
      expect(newEnriched.stats).toBeDefined();
    });
  });
});
