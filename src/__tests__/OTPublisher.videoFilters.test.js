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
    await publisher.applyVideoFilter({ type: 'backgroundBlur' });
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
      if (operation === 'clear') {
        await publisher.applyVideoFilter({ type: 'backgroundBlur' });
      }
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
      if (operation === 'clear') {
        await publisher.applyVideoFilter({ type: 'backgroundBlur' });
      }
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

  const customTransformers = [{ name: 'CustomEffect', properties: '{}' }];

  it('rejects apply with OT_NOT_SUPPORTED and preserves custom transformers', async () => {
    await publisher.setVideoTransformers(customTransformers);
    OT.setVideoTransformers.mockClear();
    await expect(
      publisher.applyVideoFilter({ type: 'backgroundBlur' })
    ).rejects.toMatchObject({
      name: 'OT_NOT_SUPPORTED',
      code: 'OT_NOT_SUPPORTED',
    });
    expect(OT.setVideoTransformers).not.toHaveBeenCalled();
    await publisher.clearVideoFilter();
    expect(OT.setVideoTransformers).not.toHaveBeenCalled();
  });

  it('allows apply once custom transformers have been explicitly removed', async () => {
    await publisher.setVideoTransformers(customTransformers);
    await publisher.setVideoTransformers([]);
    await expect(
      publisher.applyVideoFilter({ type: 'backgroundBlur' })
    ).resolves.toBeUndefined();
  });

  it('does not clear a custom pipeline that replaced a built-in filter', async () => {
    await publisher.applyVideoFilter({ type: 'backgroundBlur' });
    await publisher.setVideoTransformers(customTransformers);
    OT.setVideoTransformers.mockClear();
    await publisher.clearVideoFilter();
    expect(OT.setVideoTransformers).not.toHaveBeenCalled();
  });

  it('waits for an earlier custom update before checking for conflicts', async () => {
    let complete;
    OT.setVideoTransformers.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    const custom = publisher.setVideoTransformers(customTransformers);
    const apply = publisher.applyVideoFilter({ type: 'backgroundBlur' });
    const rejected = expect(apply).rejects.toMatchObject({
      code: 'OT_NOT_SUPPORTED',
    });
    await Promise.resolve();
    expect(OT.setVideoTransformers).toHaveBeenCalledTimes(1);
    complete();
    await custom;
    await rejected;
    expect(OT.setVideoTransformers).toHaveBeenCalledTimes(1);
  });

  it('serializes apply then clear and ends with an empty native pipeline', async () => {
    let complete;
    OT.setVideoTransformers.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    const apply = publisher.applyVideoFilter({ type: 'backgroundBlur' });
    const clear = publisher.clearVideoFilter();
    await Promise.resolve();
    expect(OT.setVideoTransformers).toHaveBeenCalledTimes(1);
    complete();
    await Promise.all([apply, clear]);
    expect(OT.setVideoTransformers).toHaveBeenLastCalledWith(
      'sid-1',
      'pub-1',
      []
    );
  });

  it('keeps custom ownership when removal fails and recovers after rejection', async () => {
    await publisher.setVideoTransformers(customTransformers);
    OT.setVideoTransformers.mockRejectedValueOnce(
      new Error('Could not remove')
    );
    await expect(publisher.setVideoTransformers([])).rejects.toThrow(
      'Could not remove'
    );
    await expect(
      publisher.applyVideoFilter({ type: 'backgroundBlur' })
    ).rejects.toMatchObject({ code: 'OT_NOT_SUPPORTED' });
    await publisher.setVideoTransformers([]);
    await expect(
      publisher.applyVideoFilter({ type: 'backgroundBlur' })
    ).resolves.toBeUndefined();
  });

  it('does not record a custom pipeline when native installation fails', async () => {
    OT.setVideoTransformers.mockRejectedValueOnce(
      new Error('Could not create')
    );
    await expect(
      publisher.setVideoTransformers(customTransformers)
    ).rejects.toThrow('Could not create');
    await expect(
      publisher.applyVideoFilter({ type: 'backgroundBlur' })
    ).resolves.toBeUndefined();
  });

  it('snapshots custom transformer input before queueing it', async () => {
    const transformers = [{ name: 'CustomEffect', properties: '{}' }];
    const pending = publisher.setVideoTransformers(transformers);
    transformers[0].name = 'Changed';
    transformers.length = 0;
    await pending;
    expect(OT.setVideoTransformers).toHaveBeenCalledWith(
      'sid-1',
      'pub-1',
      customTransformers
    );
    await expect(
      publisher.applyVideoFilter({ type: 'backgroundBlur' })
    ).rejects.toMatchObject({ code: 'OT_NOT_SUPPORTED' });
  });

  it('rejects an in-flight update and queued work after unmount', async () => {
    let complete;
    OT.setVideoTransformers.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    const pending = publisher.applyVideoFilter({ type: 'backgroundBlur' });
    const rejected = expect(pending).rejects.toMatchObject({
      code: 'OT_INVALID_STATE',
    });
    await Promise.resolve();
    publisher.componentWillUnmount();
    complete();
    await rejected;
    await expect(
      publisher.applyVideoFilter({ type: 'backgroundBlur' })
    ).rejects.toMatchObject({ code: 'OT_INVALID_STATE' });
    expect(OT.setVideoTransformers).toHaveBeenCalledTimes(1);
  });

  describe('getVideoFilter', () => {
    it('returns null before a filter has been applied', () => {
      expect(publisher.getVideoFilter()).toBeNull();
    });

    it('reports the resolved default blur strength', async () => {
      await publisher.applyVideoFilter({ type: 'backgroundBlur' });
      expect(publisher.getVideoFilter()).toEqual({
        type: 'backgroundBlur',
        blurStrength: 'high',
      });
    });

    it('reports low blur and replacement image settings', async () => {
      await publisher.applyVideoFilter({
        type: 'backgroundBlur',
        blurStrength: 'low',
      });
      expect(publisher.getVideoFilter()).toEqual({
        type: 'backgroundBlur',
        blurStrength: 'low',
      });
      const filter = {
        type: 'backgroundReplacement',
        backgroundImgUrl: '/data/bg.jpg',
      };
      await publisher.applyVideoFilter(filter);
      expect(publisher.getVideoFilter()).toEqual(filter);
    });

    it('returns null after a successful clear', async () => {
      await publisher.applyVideoFilter({ type: 'backgroundBlur' });
      await publisher.clearVideoFilter();
      expect(publisher.getVideoFilter()).toBeNull();
    });

    it('returns null for a lower-level transformer pipeline', async () => {
      await publisher.applyVideoFilter({ type: 'backgroundBlur' });
      await publisher.setVideoTransformers(customTransformers);
      expect(publisher.getVideoFilter()).toBeNull();
    });

    it('preserves the previous filter when a replacement fails', async () => {
      const previous = { type: 'backgroundBlur', blurStrength: 'low' };
      await publisher.applyVideoFilter(previous);
      OT.setVideoTransformers.mockRejectedValueOnce(new Error('Invalid image'));
      await expect(
        publisher.applyVideoFilter({
          type: 'backgroundReplacement',
          backgroundImgUrl: '/missing.jpg',
        })
      ).rejects.toThrow('Invalid image');
      expect(publisher.getVideoFilter()).toEqual(previous);
    });

    it('preserves the previous filter when clearing fails', async () => {
      await publisher.applyVideoFilter({ type: 'backgroundBlur' });
      OT.setVideoTransformers.mockRejectedValueOnce(
        new Error('Could not clear')
      );
      await expect(publisher.clearVideoFilter()).rejects.toThrow(
        'Could not clear'
      );
      expect(publisher.getVideoFilter()).toEqual({
        type: 'backgroundBlur',
        blurStrength: 'high',
      });
    });

    it('preserves the built-in filter when a custom update fails', async () => {
      await publisher.applyVideoFilter({ type: 'backgroundBlur' });
      OT.setVideoTransformers.mockRejectedValueOnce(
        new Error('Could not create')
      );
      await expect(
        publisher.setVideoTransformers(customTransformers)
      ).rejects.toThrow('Could not create');
      expect(publisher.getVideoFilter()).toEqual({
        type: 'backgroundBlur',
        blurStrength: 'high',
      });
      await publisher.clearVideoFilter();
      expect(publisher.getVideoFilter()).toBeNull();
    });

    it('does not report an initial filter until native completion', async () => {
      let complete;
      OT.setVideoTransformers.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          })
      );
      const pending = publisher.applyVideoFilter({ type: 'backgroundBlur' });
      await Promise.resolve();
      expect(publisher.getVideoFilter()).toBeNull();
      complete();
      await pending;
      expect(publisher.getVideoFilter()).toEqual({
        type: 'backgroundBlur',
        blurStrength: 'high',
      });
    });

    it('reports the old filter while a replacement is pending', async () => {
      await publisher.applyVideoFilter({
        type: 'backgroundBlur',
        blurStrength: 'low',
      });
      let complete;
      OT.setVideoTransformers.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          })
      );
      const pending = publisher.applyVideoFilter({
        type: 'backgroundBlur',
        blurStrength: 'high',
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(publisher.getVideoFilter()).toEqual({
        type: 'backgroundBlur',
        blurStrength: 'low',
      });
      complete();
      await pending;
      expect(publisher.getVideoFilter()).toEqual({
        type: 'backgroundBlur',
        blurStrength: 'high',
      });
    });

    it('reports the old filter until a pending clear completes', async () => {
      await publisher.applyVideoFilter({ type: 'backgroundBlur' });
      let complete;
      OT.setVideoTransformers.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          })
      );
      const pending = publisher.clearVideoFilter();
      await Promise.resolve();
      await Promise.resolve();
      expect(publisher.getVideoFilter()).toEqual({
        type: 'backgroundBlur',
        blurStrength: 'high',
      });
      complete();
      await pending;
      expect(publisher.getVideoFilter()).toBeNull();
    });

    it('snapshots caller input and returns independent copies', async () => {
      const filter = {
        type: 'backgroundReplacement',
        backgroundImgUrl: '/original.jpg',
      };
      const pending = publisher.applyVideoFilter(filter);
      filter.backgroundImgUrl = '/changed.jpg';
      await pending;
      const result = publisher.getVideoFilter();
      expect(result.backgroundImgUrl).toBe('/original.jpg');
      result.type = 'backgroundBlur';
      result.backgroundImgUrl = '/mutated.jpg';
      expect(publisher.getVideoFilter()).toEqual({
        type: 'backgroundReplacement',
        backgroundImgUrl: '/original.jpg',
      });
    });

    it('returns null after unmount and ignores late completions', async () => {
      await publisher.applyVideoFilter({ type: 'backgroundBlur' });
      let complete;
      OT.setVideoTransformers.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          })
      );
      const pending = publisher.applyVideoFilter({
        type: 'backgroundBlur',
        blurStrength: 'low',
      });
      const rejected = expect(pending).rejects.toMatchObject({
        code: 'OT_INVALID_STATE',
      });
      await Promise.resolve();
      await Promise.resolve();
      publisher.componentWillUnmount();
      expect(publisher.getVideoFilter()).toBeNull();
      complete();
      await rejected;
      expect(publisher.getVideoFilter()).toBeNull();
    });

    it('keeps filter state isolated between publisher instances', async () => {
      const other = new OTPublisher({ eventHandlers: {}, properties: {} });
      other.context = { sessionId: 'sid-2' };
      other.state = { ...other.state, publisherId: 'pub-2' };
      await publisher.applyVideoFilter({ type: 'backgroundBlur' });
      expect(other.getVideoFilter()).toBeNull();
      await other.applyVideoFilter({
        type: 'backgroundBlur',
        blurStrength: 'low',
      });
      await publisher.clearVideoFilter();
      expect(other.getVideoFilter()).toEqual({
        type: 'backgroundBlur',
        blurStrength: 'low',
      });
    });
  });
});
