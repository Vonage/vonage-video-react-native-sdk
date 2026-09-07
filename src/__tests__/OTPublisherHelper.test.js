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
