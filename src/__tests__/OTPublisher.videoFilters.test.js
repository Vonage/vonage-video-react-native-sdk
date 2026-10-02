// applyVideoFilter / clearVideoFilter on OTPublisher — the ergonomic layer over
// setVideoTransformers, mirroring the Web SDK's Publisher.applyVideoFilter().

jest.mock('../NativeOpentok', () => ({
  __esModule: true,
  default: {
    publish: jest.fn(),
    unpublish: jest.fn(),
    setVideoTransformers: jest.fn(),
    addNativeEvents: jest.fn(),
  },
}));

jest.mock('../OT', () => ({
  OT: {
    publish: jest.fn(),
    unpublish: jest.fn(),
    setVideoTransformers: jest.fn(),
  },
  checkAndroidPermissions: jest.fn(() => Promise.resolve()),
  nativeEvents: {},
}));

jest.mock('../helpers/OTSessionHelper', () => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  isConnected: jest.fn(() => false),
  getPublisherStream: jest.fn(() => null),
}));

jest.mock('../helpers/OTPublisherHelper', () => ({
  sanitizeProperties: jest.fn(() => ({
    audioTrack: true,
    videoTrack: true,
    videoSource: 'camera',
  })),
}));

jest.mock('../OTPublisherNativeComponent', () => 'OTRNPublisher');

jest.mock('react-native-uuid', () => ({ v4: () => 'pub-1' }));

jest.mock('../contexts/OTContext', () => {
  const React = require('react');
  return { __esModule: true, default: React.createContext({ sessionId: 'sid-1' }) };
});

import OTPublisher from '../OTPublisher';
import { OT } from '../OT';

describe('OTPublisher video filters', () => {
  let publisher;

  beforeEach(() => {
    jest.clearAllMocks();
    publisher = new OTPublisher({ eventHandlers: {}, properties: {} });
    publisher.context = { sessionId: 'sid-1' };
    publisher.state = { ...publisher.state, publisherId: 'pub-1' };
  });

  // The media library's radius values are capitalised ("Low"/"High") on both
  // platforms, while the Web SDK's blurStrength is lowercase.
  it('maps blurStrength "low" to the native radius "Low"', () => {
    publisher.applyVideoFilter({ type: 'backgroundBlur', blurStrength: 'low' });

    expect(OT.setVideoTransformers).toHaveBeenCalledWith('sid-1', 'pub-1', [
      { name: 'BackgroundBlur', properties: JSON.stringify({ radius: 'Low' }) },
    ]);
  });

  it('maps blurStrength "high" to the native radius "High"', () => {
    publisher.applyVideoFilter({ type: 'backgroundBlur', blurStrength: 'high' });

    expect(OT.setVideoTransformers).toHaveBeenCalledWith('sid-1', 'pub-1', [
      { name: 'BackgroundBlur', properties: JSON.stringify({ radius: 'High' }) },
    ]);
  });

  it('defaults an omitted blurStrength to High', () => {
    publisher.applyVideoFilter({ type: 'backgroundBlur' });

    expect(OT.setVideoTransformers).toHaveBeenCalledWith('sid-1', 'pub-1', [
      { name: 'BackgroundBlur', properties: JSON.stringify({ radius: 'High' }) },
    ]);
  });

  it('maps backgroundReplacement to image_file_path', () => {
    publisher.applyVideoFilter({
      type: 'backgroundReplacement',
      backgroundImgUrl: '/data/user/0/app/files/bg.png',
    });

    expect(OT.setVideoTransformers).toHaveBeenCalledWith('sid-1', 'pub-1', [
      {
        name: 'BackgroundReplacement',
        properties: JSON.stringify({
          image_file_path: '/data/user/0/app/files/bg.png',
        }),
      },
    ]);
  });

  it('clearVideoFilter sends an empty transformer list', () => {
    publisher.clearVideoFilter();

    expect(OT.setVideoTransformers).toHaveBeenCalledWith('sid-1', 'pub-1', []);
  });

  it('throws on an unsupported filter type', () => {
    expect(() => publisher.applyVideoFilter({ type: 'sepia' })).toThrow(
      /unsupported filter type/
    );
    expect(OT.setVideoTransformers).not.toHaveBeenCalled();
  });

  it('throws on an invalid blurStrength', () => {
    expect(() =>
      publisher.applyVideoFilter({ type: 'backgroundBlur', blurStrength: 'medium' })
    ).toThrow(/blurStrength must be/);
    expect(OT.setVideoTransformers).not.toHaveBeenCalled();
  });

  // Only an omitted blurStrength defaults; falsy values are bad input and must
  // throw rather than silently applying high blur.
  it.each([
    ['empty string', ''],
    ['null', null],
    ['false', false],
    ['zero', 0],
  ])('throws on a falsy blurStrength (%s)', (_label, blurStrength) => {
    expect(() =>
      publisher.applyVideoFilter({ type: 'backgroundBlur', blurStrength })
    ).toThrow(/blurStrength must be/);
    expect(OT.setVideoTransformers).not.toHaveBeenCalled();
  });

  it('throws when backgroundReplacement has no image', () => {
    expect(() =>
      publisher.applyVideoFilter({ type: 'backgroundReplacement' })
    ).toThrow(/non-empty backgroundImgUrl/);
    expect(() =>
      publisher.applyVideoFilter({
        type: 'backgroundReplacement',
        backgroundImgUrl: '',
      })
    ).toThrow(/non-empty backgroundImgUrl/);
    expect(OT.setVideoTransformers).not.toHaveBeenCalled();
  });
});
