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
  return {
    __esModule: true,
    default: React.createContext({ sessionId: 'sid-1' }),
  };
});

import OTPublisher from '../OTPublisher';
import { OT } from '../OT';

describe('OTPublisher video filters', () => {
  let publisher;

  beforeEach(() => {
    jest.clearAllMocks();
    OT.setVideoTransformers.mockReset();
    OT.setVideoTransformers.mockResolvedValue(undefined);
    publisher = new OTPublisher({ eventHandlers: {}, properties: {} });
    publisher.context = { sessionId: 'sid-1' };
    publisher.state = { ...publisher.state, publisherId: 'pub-1' };
  });

  // The media library's radius values are capitalised ("Low"/"High") on both
  // platforms, while the Web SDK's blurStrength is lowercase.
  it('maps blurStrength "low" to the native radius "Low"', async () => {
    await publisher.applyVideoFilter({
      type: 'backgroundBlur',
      blurStrength: 'low',
    });

    expect(OT.setVideoTransformers).toHaveBeenCalledWith('sid-1', 'pub-1', [
      { name: 'BackgroundBlur', properties: JSON.stringify({ radius: 'Low' }) },
    ]);
  });

  it('maps blurStrength "high" to the native radius "High"', async () => {
    await publisher.applyVideoFilter({
      type: 'backgroundBlur',
      blurStrength: 'high',
    });

    expect(OT.setVideoTransformers).toHaveBeenCalledWith('sid-1', 'pub-1', [
      {
        name: 'BackgroundBlur',
        properties: JSON.stringify({ radius: 'High' }),
      },
    ]);
  });

  it('defaults an omitted blurStrength to High', async () => {
    await publisher.applyVideoFilter({ type: 'backgroundBlur' });

    expect(OT.setVideoTransformers).toHaveBeenCalledWith('sid-1', 'pub-1', [
      {
        name: 'BackgroundBlur',
        properties: JSON.stringify({ radius: 'High' }),
      },
    ]);
  });

  it('maps backgroundReplacement to image_file_path', async () => {
    await publisher.applyVideoFilter({
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

  it('clearVideoFilter sends an empty transformer list', async () => {
    await publisher.clearVideoFilter();

    expect(OT.setVideoTransformers).toHaveBeenCalledWith('sid-1', 'pub-1', []);
  });

  it('rejects on an unsupported filter type', async () => {
    await expect(publisher.applyVideoFilter({ type: 'sepia' })).rejects.toThrow(
      /unsupported filter type/
    );
    expect(OT.setVideoTransformers).not.toHaveBeenCalled();
  });

  it('rejects on an invalid blurStrength', async () => {
    await expect(
      publisher.applyVideoFilter({
        type: 'backgroundBlur',
        blurStrength: 'medium',
      })
    ).rejects.toThrow(/blurStrength must be/);
    expect(OT.setVideoTransformers).not.toHaveBeenCalled();
  });

  // Only an omitted blurStrength defaults; falsy values are bad input and must
  // throw rather than silently applying high blur.
  it.each([
    ['empty string', ''],
    ['null', null],
    ['false', false],
    ['zero', 0],
  ])('rejects on a falsy blurStrength (%s)', async (_label, blurStrength) => {
    await expect(
      publisher.applyVideoFilter({ type: 'backgroundBlur', blurStrength })
    ).rejects.toThrow(/blurStrength must be/);
    expect(OT.setVideoTransformers).not.toHaveBeenCalled();
  });

  it('rejects when backgroundReplacement has no image', async () => {
    await expect(
      publisher.applyVideoFilter({ type: 'backgroundReplacement' })
    ).rejects.toThrow(/non-empty backgroundImgUrl/);
    await expect(
      publisher.applyVideoFilter({
        type: 'backgroundReplacement',
        backgroundImgUrl: '',
      })
    ).rejects.toThrow(/non-empty backgroundImgUrl/);
    expect(OT.setVideoTransformers).not.toHaveBeenCalled();
  });

  it.each(['apply', 'clear'])(
    '%s waits for native completion',
    async (operation) => {
      let complete;
      OT.setVideoTransformers.mockImplementation(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          })
      );
      let settled = false;
      const pending =
        operation === 'apply'
          ? publisher.applyVideoFilter({ type: 'backgroundBlur' })
          : publisher.clearVideoFilter();
      pending.then(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(false);
      complete();
      await pending;
      expect(settled).toBe(true);
    }
  );

  it.each(['apply', 'clear'])(
    '%s propagates native rejection',
    async (operation) => {
      const error = Object.assign(new Error('Publisher not found'), {
        code: 'OT_INVALID_STATE',
      });
      OT.setVideoTransformers.mockRejectedValueOnce(error);
      const pending =
        operation === 'apply'
          ? publisher.applyVideoFilter({ type: 'backgroundBlur' })
          : publisher.clearVideoFilter();
      await expect(pending).rejects.toBe(error);
    }
  );
});
