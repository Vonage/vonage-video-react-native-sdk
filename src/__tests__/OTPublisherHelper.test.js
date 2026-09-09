import { sanitizeProperties } from '../helpers/OTPublisherHelper';

describe('sanitizeProperties', () => {
  it('returns defaults for invalid input', () => {
    const result = sanitizeProperties(undefined);

    expect(result.publishAudio).toBe(true);
    expect(result.publishVideo).toBe(true);
    expect(result.resolution).toBe('MEDIUM');
    expect(result.frameRate).toBe(30);
  });

  it('sanitizes preferred video codecs array', () => {
    const result = sanitizeProperties({
      preferredVideoCodecs: ['vp8', 'invalid', 'h264', 'vp8'],
    });

    expect(result.preferredVideoCodecs).toBe('vp8;h264'); //it should clear duplicates and remove invalid values
  });

  describe('videoSource', () => {
    it('defaults to camera when not specified', () => {
      const result = sanitizeProperties({});
      expect(result.videoSource).toBe('camera');
    });

    it('accepts camera as a valid value', () => {
      const result = sanitizeProperties({ videoSource: 'camera' });
      expect(result.videoSource).toBe('camera');
    });

    it('accepts screen as a valid value', () => {
      const result = sanitizeProperties({ videoSource: 'screen' });
      expect(result.videoSource).toBe('screen');
    });

    it('treats any non-camera value as screen', () => {
      const result = sanitizeProperties({ videoSource: 'something-else' });
      expect(result.videoSource).toBe('screen');
      // NOTE: audioFallback is computed from the raw videoSource before sanitization,
      // so 'something-else' !== 'screen' means fallback stays enabled despite
      // the output videoSource being 'screen'. This is pre-existing behavior.
      expect(result.subscriberAudioFallback).toBe(true);
    });

    it('disables subscriber audio fallback by default when videoSource is screen', () => {
      const result = sanitizeProperties({ videoSource: 'screen' });
      expect(result.subscriberAudioFallback).toBe(false);
    });

    it('disables publisher audio fallback by default when videoSource is screen', () => {
      const result = sanitizeProperties({ videoSource: 'screen' });
      expect(result.publisherAudioFallback).toBe(false);
    });

    it('enables subscriber audio fallback by default when videoSource is camera', () => {
      const result = sanitizeProperties({ videoSource: 'camera' });
      expect(result.subscriberAudioFallback).toBe(true);
    });

    it('respects explicit audioFallback.subscriber override for screen', () => {
      const result = sanitizeProperties({
        videoSource: 'screen',
        audioFallback: { subscriber: true },
      });
      expect(result.subscriberAudioFallback).toBe(true);
    });

    it('respects explicit audioFallback.publisher override for screen', () => {
      const result = sanitizeProperties({
        videoSource: 'screen',
        audioFallback: { publisher: true },
      });
      expect(result.publisherAudioFallback).toBe(true);
    });
  });
});

describe('sanitizeProperties - numeric and enum sanitizers', () => {
  describe('resolution', () => {
    it.each([
      ['352x288', 'LOW'],
      ['640x480', 'MEDIUM'],
      ['1280x720', 'HIGH'],
      ['1920x1080', 'HIGH_1080P'],
    ])('maps %s to %s', (input, expected) => {
      expect(sanitizeProperties({ resolution: input }).resolution).toBe(
        expected
      );
    });

    it('falls back to MEDIUM for an unknown resolution', () => {
      expect(sanitizeProperties({ resolution: '9999x9999' }).resolution).toBe(
        'MEDIUM'
      );
    });
  });

  describe('frameRate', () => {
    it.each([
      [1, 1],
      [7, 7],
      [15, 15],
      [30, 30],
    ])('keeps whitelisted frame rate %s', (input, expected) => {
      expect(sanitizeProperties({ frameRate: input }).frameRate).toBe(expected);
    });

    it('falls back to 30 for a non-whitelisted frame rate', () => {
      expect(sanitizeProperties({ frameRate: 24 }).frameRate).toBe(30);
    });
  });

  describe('audioBitrate', () => {
    it('keeps a value within the valid range', () => {
      expect(sanitizeProperties({ audioBitrate: 128000 }).audioBitrate).toBe(
        128000
      );
    });

    it('resets to 40000 below the minimum (6000)', () => {
      expect(sanitizeProperties({ audioBitrate: 5999 }).audioBitrate).toBe(
        40000
      );
    });

    it('resets to 40000 above the maximum (510000)', () => {
      expect(sanitizeProperties({ audioBitrate: 510001 }).audioBitrate).toBe(
        40000
      );
    });

    it('accepts the exact boundaries', () => {
      expect(sanitizeProperties({ audioBitrate: 6000 }).audioBitrate).toBe(6000);
      expect(sanitizeProperties({ audioBitrate: 510000 }).audioBitrate).toBe(
        510000
      );
    });
  });

  describe('degradationPreference', () => {
    it.each([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ])('keeps supported value %s', (input, expected) => {
      expect(
        sanitizeProperties({ degradationPreference: input })
          .degradationPreference
      ).toBe(expected);
    });

    it('falls back to -1 for an unsupported value', () => {
      expect(
        sanitizeProperties({ degradationPreference: 9 }).degradationPreference
      ).toBe(-1);
    });

    it('defaults to -1 when omitted', () => {
      expect(sanitizeProperties({}).degradationPreference).toBe(-1);
    });
  });

  describe('videoContentHint', () => {
    it.each([
      ['motion', 'motion'],
      ['detail', 'detail'],
      ['text', 'text'],
    ])('keeps supported hint %s', (input, expected) => {
      expect(
        sanitizeProperties({ videoContentHint: input }).videoContentHint
      ).toBe(expected);
    });

    it('falls back to empty string for an unsupported hint', () => {
      expect(
        sanitizeProperties({ videoContentHint: 'bogus' }).videoContentHint
      ).toBe('');
    });
  });

  describe('cameraPosition / cameraTorch / cameraZoomFactor', () => {
    it("defaults cameraPosition to 'front'", () => {
      expect(sanitizeProperties({}).cameraPosition).toBe('front');
    });

    it('passes through a non-front camera position', () => {
      expect(sanitizeProperties({ cameraPosition: 'back' }).cameraPosition).toBe(
        'back'
      );
    });

    it('coerces cameraTorch to a boolean', () => {
      expect(sanitizeProperties({ cameraTorch: 1 }).cameraTorch).toBe(true);
      expect(sanitizeProperties({ cameraTorch: 0 }).cameraTorch).toBe(false);
    });

    it('coerces cameraZoomFactor to a number', () => {
      expect(
        sanitizeProperties({ cameraZoomFactor: '2' }).cameraZoomFactor
      ).toBe(2);
    });

    it('defaults cameraZoomFactor to 1', () => {
      expect(sanitizeProperties({}).cameraZoomFactor).toBe(1);
    });
  });

  describe('maxVideoBitrate (post-fix: derived from properties.maxVideoBitrate)', () => {
    it('clamps a value into the [5000, 10000000] range', () => {
      expect(sanitizeProperties({ maxVideoBitrate: 2000000 }).maxVideoBitrate).toBe(
        2000000
      );
    });

    it('raises a value below the minimum up to 5000', () => {
      expect(sanitizeProperties({ maxVideoBitrate: 1000 }).maxVideoBitrate).toBe(
        5000
      );
    });

    it('caps a value above the maximum at 10000000', () => {
      expect(
        sanitizeProperties({ maxVideoBitrate: 99999999 }).maxVideoBitrate
      ).toBe(10000000);
    });

    it('returns 0 when maxVideoBitrate is omitted', () => {
      expect(sanitizeProperties({}).maxVideoBitrate).toBe(0);
    });

    it('is not affected by videoBitratePreset (regression guard for the arg-swap bug)', () => {
      // Previously maxVideoBitrate was mistakenly derived from videoBitratePreset,
      // which forced it to 0 for every input. It must now reflect maxVideoBitrate.
      const result = sanitizeProperties({
        maxVideoBitrate: 750000,
        videoBitratePreset: 'bw_saver',
      });
      expect(result.maxVideoBitrate).toBe(750000);
    });
  });

  describe('videoBitratePreset', () => {
    it.each([
      ['bw_saver', 'bw_saver'],
      ['extra_bw_saver', 'extra_bw_saver'],
    ])('keeps supported preset %s when no maxVideoBitrate is set', (input, expected) => {
      expect(
        sanitizeProperties({ videoBitratePreset: input }).videoBitratePreset
      ).toBe(expected);
    });

    it("falls back to 'default' for an unsupported preset", () => {
      expect(
        sanitizeProperties({ videoBitratePreset: 'turbo' }).videoBitratePreset
      ).toBe('default');
    });

    it('is cleared to empty string when maxVideoBitrate is set (max bitrate wins)', () => {
      const result = sanitizeProperties({
        videoBitratePreset: 'bw_saver',
        maxVideoBitrate: 750000,
      });
      expect(result.videoBitratePreset).toBe('');
    });
  });

  describe('boolean coercions', () => {
    it('coerces scalableScreenshare, allowAudioCaptureWhileMuted, publishSenderStats to booleans', () => {
      const result = sanitizeProperties({
        scalableScreenshare: 1,
        allowAudioCaptureWhileMuted: 'yes',
        publishSenderStats: 0,
      });
      expect(result.scalableScreenshare).toBe(true);
      expect(result.allowAudioCaptureWhileMuted).toBe(true);
      expect(result.publishSenderStats).toBe(false);
    });
  });

  describe('preferredVideoCodecs', () => {
    it("passes through 'automatic'", () => {
      expect(
        sanitizeProperties({ preferredVideoCodecs: 'automatic' })
          .preferredVideoCodecs
      ).toBe('automatic');
    });

    it('returns empty string for an unrecognized string', () => {
      expect(
        sanitizeProperties({ preferredVideoCodecs: 'nonsense' })
          .preferredVideoCodecs
      ).toBe('');
    });

    it('returns empty string for an empty array', () => {
      expect(
        sanitizeProperties({ preferredVideoCodecs: [] }).preferredVideoCodecs
      ).toBe('');
    });

    it('preserves the order of valid codecs', () => {
      expect(
        sanitizeProperties({ preferredVideoCodecs: ['h264', 'vp9', 'vp8'] })
          .preferredVideoCodecs
      ).toBe('h264;vp9;vp8');
    });
  });
});
