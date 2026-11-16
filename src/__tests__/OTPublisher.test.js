import React from 'react';
import { act, create } from 'react-test-renderer';

jest.mock('../NativeOpentok', () => ({
  __esModule: true,
  default: {
    publish: jest.fn(),
    unpublish: jest.fn(),
    setAudioTransformers: jest.fn(),
  },
}));

import OpentokReactNative from '../NativeOpentok';
import OTPublisher from '../OTPublisher';
import OTContext from '../contexts/OTContext';
import { setIsConnected, dispatchEvent } from '../helpers/OTSessionHelper';

const SESSION_ID = 'test-session-id';

const renderPublisher = (props = {}, contextValue = { sessionId: SESSION_ID }) => {
  let renderer;
  act(() => {
    renderer = create(
      contextValue ? (
        <OTContext.Provider value={contextValue}>
          <OTPublisher {...props} />
        </OTContext.Provider>
      ) : (
        <OTPublisher {...props} />
      )
    );
  });
  return renderer;
};

const getNativePublisher = (renderer) =>
  renderer.root.find(
    (node) => typeof node.type !== 'function' && node.props.publisherId
  );

const updatePublisher = (renderer, props) => {
  act(() => {
    renderer.update(
      <OTContext.Provider value={{ sessionId: SESSION_ID }}>
        <OTPublisher {...props} />
      </OTContext.Provider>
    );
  });
};

const flushPublishTimers = () => {
  // OTPublisher defers its initial publish call by 100ms
  act(() => {
    jest.advanceTimersByTime(150);
  });
};

describe('OTPublisher previewOnly', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setIsConnected(SESSION_ID, true);
  });

  afterEach(() => {
    setIsConnected(SESSION_ID, false);
    jest.useRealTimers();
  });

  it('publishes on mount when the session is connected (default behavior)', () => {
    renderPublisher();
    flushPublishTimers();

    expect(OpentokReactNative.publish).toHaveBeenCalledTimes(1);
    expect(OpentokReactNative.publish).toHaveBeenCalledWith(
      SESSION_ID,
      expect.any(String)
    );
  });

  it('does not publish on mount when previewOnly is true', () => {
    renderPublisher({ previewOnly: true });
    flushPublishTimers();

    expect(OpentokReactNative.publish).not.toHaveBeenCalled();
  });

  it('does not publish when the session connects while previewOnly is true', () => {
    renderPublisher({ previewOnly: true });
    flushPublishTimers();
    act(() => {
      dispatchEvent(SESSION_ID, 'sessionConnected', {});
    });

    expect(OpentokReactNative.publish).not.toHaveBeenCalled();
  });

  it('publishes once when previewOnly flips to false on a connected session', () => {
    const renderer = renderPublisher({ previewOnly: true });
    flushPublishTimers();

    act(() => {
      renderer.update(
        <OTContext.Provider value={{ sessionId: SESSION_ID }}>
          <OTPublisher previewOnly={false} />
        </OTContext.Provider>
      );
    });

    expect(OpentokReactNative.publish).toHaveBeenCalledTimes(1);
    expect(OpentokReactNative.publish).toHaveBeenCalledWith(
      SESSION_ID,
      expect.any(String)
    );

    // A re-render with previewOnly still false must not publish again
    act(() => {
      renderer.update(
        <OTContext.Provider value={{ sessionId: SESSION_ID }}>
          <OTPublisher previewOnly={false} />
        </OTContext.Provider>
      );
    });

    expect(OpentokReactNative.publish).toHaveBeenCalledTimes(1);
  });

  it('publishes on sessionConnected after previewOnly flips to false on a disconnected session', () => {
    setIsConnected(SESSION_ID, false);
    const renderer = renderPublisher({ previewOnly: true });
    flushPublishTimers();

    act(() => {
      renderer.update(
        <OTContext.Provider value={{ sessionId: SESSION_ID }}>
          <OTPublisher previewOnly={false} />
        </OTContext.Provider>
      );
    });
    expect(OpentokReactNative.publish).not.toHaveBeenCalled();

    act(() => {
      setIsConnected(SESSION_ID, true);
      dispatchEvent(SESSION_ID, 'sessionConnected', {});
    });

    expect(OpentokReactNative.publish).toHaveBeenCalledTimes(1);
  });

  it('does not unpublish on unmount when the publisher never published', () => {
    const renderer = renderPublisher({ previewOnly: true });
    flushPublishTimers();
    act(() => {
      renderer.unmount();
    });

    expect(OpentokReactNative.unpublish).not.toHaveBeenCalled();
  });

  it('unpublishes on unmount after publishing', () => {
    const renderer = renderPublisher();
    flushPublishTimers();
    expect(OpentokReactNative.publish).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.unmount();
    });

    expect(OpentokReactNative.unpublish).toHaveBeenCalledTimes(1);
    expect(OpentokReactNative.unpublish).toHaveBeenCalledWith(
      SESSION_ID,
      expect.any(String)
    );
  });

  it('mounts and unmounts standalone (outside OTSession) without publishing', () => {
    const renderer = renderPublisher({ previewOnly: true }, null);
    flushPublishTimers();
    act(() => {
      renderer.unmount();
    });

    expect(OpentokReactNative.publish).not.toHaveBeenCalled();
    expect(OpentokReactNative.unpublish).not.toHaveBeenCalled();
  });

  it('publishes again on sessionConnected after a failed publish', () => {
    const error = jest.fn();
    const renderer = renderPublisher({ eventHandlers: { error } });
    flushPublishTimers();
    expect(OpentokReactNative.publish).toHaveBeenCalledTimes(1);

    act(() => {
      getNativePublisher(renderer).props.onError({
        nativeEvent: { code: 1500, message: 'Unable to publish' },
      });
    });
    expect(error).toHaveBeenCalledWith({
      code: 1500,
      message: 'Unable to publish',
    });

    act(() => {
      dispatchEvent(SESSION_ID, 'sessionConnected', {});
    });
    expect(OpentokReactNative.publish).toHaveBeenCalledTimes(2);
  });

  it('keeps the published state when an error arrives after the stream exists', () => {
    const renderer = renderPublisher();
    flushPublishTimers();
    const nativePublisher = getNativePublisher(renderer);
    act(() => {
      nativePublisher.props.onStreamCreated({
        nativeEvent: { streamId: 'stream-1' },
      });
      nativePublisher.props.onError({ nativeEvent: { code: 1600 } });
      dispatchEvent(SESSION_ID, 'sessionConnected', {});
    });

    expect(OpentokReactNative.publish).toHaveBeenCalledTimes(1);
    act(() => {
      renderer.unmount();
    });
  });

  it('publishes again on sessionConnected after the published stream is destroyed', () => {
    const renderer = renderPublisher();
    flushPublishTimers();
    const nativePublisher = getNativePublisher(renderer);
    act(() => {
      nativePublisher.props.onStreamCreated({
        nativeEvent: { streamId: 'stream-2' },
      });
      nativePublisher.props.onStreamDestroyed({
        streamId: 'stream-2',
        nativeEvent: { streamId: 'stream-2' },
      });
      dispatchEvent(SESSION_ID, 'sessionConnected', {});
    });

    expect(OpentokReactNative.publish).toHaveBeenCalledTimes(2);
  });

  it('holds audio transformers set during preview until the stream is created', () => {
    const ref = React.createRef();
    const transformers = [{ name: 'NoiseSuppression', properties: '' }];
    const renderer = renderPublisher({ previewOnly: true, ref });
    flushPublishTimers();

    ref.current.setAudioTransformers(transformers);
    expect(OpentokReactNative.setAudioTransformers).not.toHaveBeenCalled();

    updatePublisher(renderer, { previewOnly: false, ref });
    expect(OpentokReactNative.publish).toHaveBeenCalledTimes(1);
    expect(OpentokReactNative.setAudioTransformers).not.toHaveBeenCalled();

    act(() => {
      getNativePublisher(renderer).props.onStreamCreated({
        nativeEvent: { streamId: 'stream-3' },
      });
    });
    expect(OpentokReactNative.setAudioTransformers).toHaveBeenCalledTimes(1);
    expect(OpentokReactNative.setAudioTransformers).toHaveBeenCalledWith(
      SESSION_ID,
      ref.current.state.publisherId,
      transformers
    );
    act(() => {
      renderer.unmount();
    });
  });

  it('applies audio transformers right away when not previewing', () => {
    const ref = React.createRef();
    renderPublisher({ ref });
    flushPublishTimers();

    ref.current.setAudioTransformers([]);
    expect(OpentokReactNative.setAudioTransformers).toHaveBeenCalledTimes(1);
  });

  it('warns when previewOnly is turned back on after publishing', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const renderer = renderPublisher({ previewOnly: false });
    flushPublishTimers();
    expect(OpentokReactNative.publish).toHaveBeenCalledTimes(1);

    updatePublisher(renderer, { previewOnly: true });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('previewOnly cannot be turned back on')
    );
    expect(OpentokReactNative.unpublish).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
