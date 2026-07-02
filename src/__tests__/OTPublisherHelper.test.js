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

  // Regression: maxVideoBitrate was sanitized from the wrong field
  // (videoBitratePreset, a string) so it was always 0 and silently ignored.
  it('applies maxVideoBitrate instead of always returning 0', () => {
    expect(sanitizeProperties({ maxVideoBitrate: 2000000 }).maxVideoBitrate).toBe(
      2000000
    );
    // clamps within the valid range and defaults to 0 when unset
    expect(sanitizeProperties({ maxVideoBitrate: 1000 }).maxVideoBitrate).toBe(
      5000
    );
    expect(sanitizeProperties({}).maxVideoBitrate).toBe(0);
  });
});
