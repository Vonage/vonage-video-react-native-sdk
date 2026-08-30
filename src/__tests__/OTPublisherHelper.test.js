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

// Regression for #173: mistyped props must be coerced to the native-expected
// type, otherwise they reach the Fabric String/Boolean prop casts and crash
// the app with a ClassCastException.
describe('sanitizeProperties type coercion (#173)', () => {
  it('coerces a non-string name to a string', () => {
    const result = sanitizeProperties({ name: 12345 });

    expect(typeof result.name).toBe('string');
    expect(result.name).toBe('12345');
  });

  it('coerces mistyped boolean props to real booleans', () => {
    expect(sanitizeProperties({ videoTrack: 0 }).videoTrack).toBe(false);
    expect(sanitizeProperties({ audioTrack: '' }).audioTrack).toBe(false);
    expect(sanitizeProperties({ publishAudio: null }).publishAudio).toBe(false);
    expect(typeof sanitizeProperties({ videoTrack: 0 }).videoTrack).toBe(
      'boolean'
    );
  });

  it('still defaults omitted boolean props to true', () => {
    const result = sanitizeProperties({});

    expect(result.videoTrack).toBe(true);
    expect(result.audioTrack).toBe(true);
  });
});
