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
