// Tests for the video-filter API (mirrors the Web SDK's applyVideoFilter):
// applyVideoFilter / clearVideoFilter / setVideoTransformers on OTPublisher.

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  View: ({ children }) => children ?? null,
}));
jest.mock('../OT', () => ({
  OT: {
    setVideoTransformers: jest.fn(),
    publish: jest.fn(),
    unpublish: jest.fn(),
    getPublisherRtcStatsReport: jest.fn(),
  },
  checkAndroidPermissions: jest.fn(() => Promise.resolve()),
}));
jest.mock(
  'deprecated-react-native-prop-types',
  () => ({ ViewPropTypes: { style: () => null } }),
  { virtual: true }
);
jest.mock('react-native-uuid', () => ({ v4: () => 'pub-uuid-1' }));
jest.mock('../OTPublisherNativeComponent', () => 'OTRNPublisher');
jest.mock('../helpers/OTPublisherHelper', () => ({
  sanitizeProperties: () => ({ audioTrack: true, videoTrack: true, videoSource: 'camera' }),
}));
jest.mock('../helpers/OTSessionHelper', () => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  isConnected: jest.fn(() => false),
  getPublisherStream: jest.fn(() => null),
}));

import OTPublisher from '../OTPublisher';
import { OT } from '../OT';

const makePublisher = () => {
  const pub = new OTPublisher({ eventHandlers: {}, properties: {} });
  pub.context = { sessionId: 'sid-1' };
  pub.state = { ...pub.state, publisherId: 'pub-1' };
  OT.setVideoTransformers.mockClear();
  return pub;
};

describe('OTPublisher video filters', () => {
  it('setVideoTransformers forwards to the native module with session + publisher ids', () => {
    const pub = makePublisher();
    const transformers = [{ name: 'BackgroundBlur', properties: '{}' }];
    pub.setVideoTransformers(transformers);
    expect(OT.setVideoTransformers).toHaveBeenCalledWith('sid-1', 'pub-1', transformers);
  });

  it('applyVideoFilter(backgroundBlur) maps to a BackgroundBlur transformer', () => {
    const pub = makePublisher();
    pub.applyVideoFilter({ type: 'backgroundBlur', blurStrength: 'low' });
    expect(OT.setVideoTransformers).toHaveBeenCalledWith('sid-1', 'pub-1', [
      { name: 'BackgroundBlur', properties: JSON.stringify({ radius: 'low' }) },
    ]);
  });

  it('applyVideoFilter(backgroundBlur) defaults blurStrength to high', () => {
    const pub = makePublisher();
    pub.applyVideoFilter({ type: 'backgroundBlur' });
    expect(OT.setVideoTransformers).toHaveBeenCalledWith('sid-1', 'pub-1', [
      { name: 'BackgroundBlur', properties: JSON.stringify({ radius: 'high' }) },
    ]);
  });

  it('applyVideoFilter(backgroundReplacement) maps the image to image_file_path', () => {
    const pub = makePublisher();
    pub.applyVideoFilter({ type: 'backgroundReplacement', backgroundImgUrl: '/tmp/bg.png' });
    expect(OT.setVideoTransformers).toHaveBeenCalledWith('sid-1', 'pub-1', [
      { name: 'BackgroundReplacement', properties: JSON.stringify({ image_file_path: '/tmp/bg.png' }) },
    ]);
  });

  it('clearVideoFilter sends an empty transformer list', () => {
    const pub = makePublisher();
    pub.clearVideoFilter();
    expect(OT.setVideoTransformers).toHaveBeenCalledWith('sid-1', 'pub-1', []);
  });

  it('applyVideoFilter throws on an unsupported filter type', () => {
    const pub = makePublisher();
    expect(() => pub.applyVideoFilter({ type: 'sepia' })).toThrow(/unsupported filter type/);
    expect(OT.setVideoTransformers).not.toHaveBeenCalled();
  });

  it('applyVideoFilter throws on an invalid blurStrength', () => {
    const pub = makePublisher();
    expect(() =>
      pub.applyVideoFilter({ type: 'backgroundBlur', blurStrength: 'medium' })
    ).toThrow(/blurStrength must be/);
    expect(OT.setVideoTransformers).not.toHaveBeenCalled();
  });

  it('applyVideoFilter throws when backgroundReplacement has no image', () => {
    const pub = makePublisher();
    expect(() => pub.applyVideoFilter({ type: 'backgroundReplacement' })).toThrow(
      /non-empty backgroundImgUrl/
    );
    expect(() =>
      pub.applyVideoFilter({ type: 'backgroundReplacement', backgroundImgUrl: '' })
    ).toThrow(/non-empty backgroundImgUrl/);
    expect(OT.setVideoTransformers).not.toHaveBeenCalled();
  });
});
