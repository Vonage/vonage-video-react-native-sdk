import {
  sanitizeProperties,
  sanitizeStreamProperties,
} from '../helpers/OTSubscriberHelper';

// The largest safe value the helper uses as the "unbounded" sentinel for
// resolution/frame rate. Mirrors MAX_SAFE_INTEGER in OTSubscriberHelper.js.
const MAX_SAFE_INTEGER = 32767;

describe('OTSubscriberHelper', () => {
  describe('sanitizeProperties', () => {
    describe('non-object input', () => {
      it('returns defaults for undefined', () => {
        const result = sanitizeProperties(undefined);

        expect(result).toEqual({
          subscribeToAudio: true,
          subscribeToVideo: true,
          subscribeToCaptions: false,
          preferredResolution: {
            width: MAX_SAFE_INTEGER,
            height: MAX_SAFE_INTEGER,
          },
          preferredFrameRate: MAX_SAFE_INTEGER,
          audioVolume: 100,
          scaleBehavior: 'fill',
        });
      });

      it('returns defaults for a string', () => {
        const result = sanitizeProperties('not-an-object');
        expect(result.subscribeToAudio).toBe(true);
        expect(result.audioVolume).toBe(100);
        expect(result.scaleBehavior).toBe('fill');
      });
    });

    describe('subscribeToAudio / subscribeToVideo (boolean defaulting)', () => {
      // sanitizeBooleanProperty returns true for `true` and for `undefined`,
      // and only returns false when explicitly passed false.
      it('defaults to true when omitted', () => {
        const result = sanitizeProperties({});
        expect(result.subscribeToAudio).toBe(true);
        expect(result.subscribeToVideo).toBe(true);
      });

      it('respects explicit false', () => {
        const result = sanitizeProperties({
          subscribeToAudio: false,
          subscribeToVideo: false,
        });
        expect(result.subscribeToAudio).toBe(false);
        expect(result.subscribeToVideo).toBe(false);
      });

      it('respects explicit true', () => {
        const result = sanitizeProperties({
          subscribeToAudio: true,
          subscribeToVideo: true,
        });
        expect(result.subscribeToAudio).toBe(true);
        expect(result.subscribeToVideo).toBe(true);
      });
    });

    describe('subscribeToCaptions', () => {
      it('defaults to false when omitted', () => {
        const result = sanitizeProperties({});
        expect(result.subscribeToCaptions).toBe(false);
      });

      it('is true when explicitly enabled', () => {
        const result = sanitizeProperties({ subscribeToCaptions: true });
        expect(result.subscribeToCaptions).toBe(true);
      });
    });

    describe('scaleBehavior', () => {
      it("defaults to 'fill' when omitted", () => {
        expect(sanitizeProperties({}).scaleBehavior).toBe('fill');
      });

      it('passes through a provided value verbatim', () => {
        expect(sanitizeProperties({ scaleBehavior: 'fit' }).scaleBehavior).toBe(
          'fit'
        );
      });
    });
  });

  describe('sanitizeProperties - preferredResolution', () => {
    it('uses the MAX_SAFE_INTEGER sentinel when resolution is omitted', () => {
      const result = sanitizeProperties({});
      expect(result.preferredResolution).toEqual({
        width: MAX_SAFE_INTEGER,
        height: MAX_SAFE_INTEGER,
      });
    });

    it('uses the sentinel when resolution is null', () => {
      const result = sanitizeProperties({ preferredResolution: null });
      expect(result.preferredResolution).toEqual({
        width: MAX_SAFE_INTEGER,
        height: MAX_SAFE_INTEGER,
      });
    });

    it('parses numeric width and height', () => {
      const result = sanitizeProperties({
        preferredResolution: { width: 1280, height: 720 },
      });
      expect(result.preferredResolution).toEqual({ width: 1280, height: 720 });
    });

    it('parses string dimensions into integers', () => {
      const result = sanitizeProperties({
        preferredResolution: { width: '640', height: '480' },
      });
      expect(result.preferredResolution).toEqual({ width: 640, height: 480 });
    });

    it('sets a missing dimension to undefined', () => {
      const result = sanitizeProperties({
        preferredResolution: { width: 640 },
      });
      expect(result.preferredResolution.width).toBe(640);
      expect(result.preferredResolution.height).toBeUndefined();
    });
  });

  describe('sanitizeProperties - preferredFrameRate', () => {
    it.each([
      [1, 1],
      [7, 7],
      [15, 15],
      [30, 30],
    ])('keeps whitelisted frame rate %s', (input, expected) => {
      expect(
        sanitizeProperties({ preferredFrameRate: input }).preferredFrameRate
      ).toBe(expected);
    });

    it('uses the MAX_SAFE_INTEGER sentinel when frame rate is null', () => {
      expect(
        sanitizeProperties({ preferredFrameRate: null }).preferredFrameRate
      ).toBe(MAX_SAFE_INTEGER);
    });

    it('falls back to 30 for a non-whitelisted value', () => {
      expect(
        sanitizeProperties({ preferredFrameRate: 24 }).preferredFrameRate
      ).toBe(30);
    });

    it('falls back to 30 when omitted (undefined hits the default branch, not the null sentinel)', () => {
      // Only an explicit `null` yields the MAX_SAFE_INTEGER sentinel. An omitted
      // property is `undefined`, which is not a whitelisted case → default → 30.
      expect(sanitizeProperties({}).preferredFrameRate).toBe(30);
    });
  });

  describe('sanitizeProperties - audioVolume', () => {
    it('defaults to 100 when omitted', () => {
      expect(sanitizeProperties({}).audioVolume).toBe(100);
    });

    it('passes through a numeric volume', () => {
      expect(sanitizeProperties({ audioVolume: 50 }).audioVolume).toBe(50);
    });

    it('accepts 0 as a valid volume', () => {
      expect(sanitizeProperties({ audioVolume: 0 }).audioVolume).toBe(0);
    });

    it('falls back to 100 for a non-numeric volume', () => {
      expect(sanitizeProperties({ audioVolume: 'loud' }).audioVolume).toBe(100);
    });
  });

  describe('sanitizeStreamProperties', () => {
    it('sanitizes per-stream booleans in place', () => {
      const streamProperties = {
        'stream-1': { subscribeToAudio: false, subscribeToVideo: true },
      };

      sanitizeStreamProperties(streamProperties);

      expect(streamProperties['stream-1'].subscribeToAudio).toBe(false);
      expect(streamProperties['stream-1'].subscribeToVideo).toBe(true);
    });

    it('normalizes per-stream resolution and frame rate', () => {
      const streamProperties = {
        'stream-1': {
          preferredResolution: { width: '640', height: '480' },
          preferredFrameRate: 15,
        },
      };

      sanitizeStreamProperties(streamProperties);

      expect(streamProperties['stream-1'].preferredResolution).toEqual({
        width: 640,
        height: 480,
      });
      expect(streamProperties['stream-1'].preferredFrameRate).toBe(15);
    });

    it('coerces a non-whitelisted frame rate to 30', () => {
      const streamProperties = {
        'stream-1': { preferredFrameRate: 24 },
      };

      sanitizeStreamProperties(streamProperties);

      expect(streamProperties['stream-1'].preferredFrameRate).toBe(30);
    });

    it('normalizes a non-numeric audioVolume to 100', () => {
      const streamProperties = {
        'stream-1': { audioVolume: 'loud' },
      };

      sanitizeStreamProperties(streamProperties);

      expect(streamProperties['stream-1'].audioVolume).toBe(100);
    });

    it('leaves omitted properties untouched (no keys added)', () => {
      const streamProperties = {
        'stream-1': { subscribeToAudio: true },
      };

      sanitizeStreamProperties(streamProperties);

      expect(Object.keys(streamProperties['stream-1'])).toEqual([
        'subscribeToAudio',
      ]);
    });

    it('passes scaleBehavior through unchanged', () => {
      const streamProperties = {
        'stream-1': { scaleBehavior: 'fit' },
      };

      sanitizeStreamProperties(streamProperties);

      expect(streamProperties['stream-1'].scaleBehavior).toBe('fit');
    });

    it('handles multiple streams independently', () => {
      const streamProperties = {
        'stream-1': { subscribeToAudio: false },
        'stream-2': { preferredFrameRate: 7 },
      };

      sanitizeStreamProperties(streamProperties);

      expect(streamProperties['stream-1'].subscribeToAudio).toBe(false);
      expect(streamProperties['stream-2'].preferredFrameRate).toBe(7);
    });
  });
});
