import React from 'react';
import { act, create } from 'react-test-renderer';

jest.mock('../NativeOpentok', () => ({
  __esModule: true,
  default: {
    publish: jest.fn(),
    unpublish: jest.fn(),
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
});
