jest.mock('../NativeOpentok', () => ({ __esModule: true, default: {} }));
jest.mock('../OT', () => ({
  OT: { publish: jest.fn(), unpublish: jest.fn() },
  checkAndroidPermissions: jest.fn(() => Promise.resolve()),
  nativeEvents: {},
}));
jest.mock('../OTPublisherNativeComponent', () => 'OTRNPublisher');
jest.mock('../contexts/OTContext', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.createContext({ sessionId: 'multi-session' }),
  };
});
jest.mock('react-native-uuid', () => {
  let n = 0;
  return { v4: () => `publisher-${++n}` };
});
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  View: 'View',
}));

import OTPublisher from '../OTPublisher';
import OTSubscriber from '../OTSubscriber';
import {
  addEventListener,
  dispatchEvent,
  getPublisherStreams,
  clearStreams,
} from '../helpers/OTSessionHelper';

const SESSION = 'multi-session';

const makePublisher = (handlers = {}) => {
  const publisher = new OTPublisher({
    eventHandlers: handlers,
    properties: {},
    style: {},
  });
  publisher.context = { sessionId: SESSION };
  return publisher;
};

const createStream = (publisher, streamId) => {
  const element = publisher.render();
  element.props.onStreamCreated({ nativeEvent: { streamId } });
};

describe('Several OTPublisher components in one session', () => {
  beforeEach(() => {
    addEventListener(SESSION, 'publisherStreamCreated', jest.fn());
    addEventListener(SESSION, 'publisherStreamDestroyed', jest.fn());
    jest.spyOn(OTPublisher.prototype, 'render');
  });

  afterEach(() => {
    clearStreams(SESSION);
    jest.restoreAllMocks();
  });

  const mount = (publisher) => {
    publisher.state = {
      ...publisher.state,
      permissionsGranted: true,
      componentMounted: true,
    };
  };

  it('keeps both streams after both publishers create one', () => {
    const camera = makePublisher();
    const screen = makePublisher();
    mount(camera);
    mount(screen);
    createStream(camera, 'camera-stream');
    createStream(screen, 'screen-stream');

    expect(getPublisherStreams(SESSION)).toEqual([
      'camera-stream',
      'screen-stream',
    ]);
  });

  it('reports its own stream when one of two publishers unmounts', () => {
    const cameraHandler = jest.fn();
    const screenHandler = jest.fn();
    const camera = makePublisher({ streamDestroyed: cameraHandler });
    const screen = makePublisher({ streamDestroyed: screenHandler });
    mount(camera);
    mount(screen);
    createStream(camera, 'camera-stream');
    createStream(screen, 'screen-stream');

    camera.componentWillUnmount();

    expect(cameraHandler).toHaveBeenCalledWith({ streamId: 'camera-stream' });
    expect(screenHandler).not.toHaveBeenCalled();
    expect(getPublisherStreams(SESSION)).toEqual(['screen-stream']);
  });

  it('does not report the stream of another publisher when it has no stream yet', () => {
    const lateHandler = jest.fn();
    const camera = makePublisher();
    const late = makePublisher({ streamDestroyed: lateHandler });
    mount(camera);
    mount(late);
    createStream(camera, 'camera-stream');

    late.componentWillUnmount();

    expect(lateHandler).not.toHaveBeenCalled();
    expect(getPublisherStreams(SESSION)).toEqual(['camera-stream']);
  });

  it('removes only the destroyed stream when the native destroyed event arrives', () => {
    const camera = makePublisher();
    const screen = makePublisher();
    mount(camera);
    mount(screen);
    createStream(camera, 'camera-stream');
    createStream(screen, 'screen-stream');

    screen
      .render()
      .props.onStreamDestroyed({ nativeEvent: { streamId: 'screen-stream' } });

    expect(getPublisherStreams(SESSION)).toEqual(['camera-stream']);
  });

  it('reports the new stream on unmount after a stream was destroyed and another created', () => {
    const handler = jest.fn();
    const publisher = makePublisher({ streamDestroyed: handler });
    mount(publisher);
    createStream(publisher, 'stream-a');
    publisher.render().props.onStreamDestroyed({ nativeEvent: { streamId: 'stream-a' } });
    createStream(publisher, 'stream-b');

    publisher.componentWillUnmount();

    expect(handler).toHaveBeenLastCalledWith({ streamId: 'stream-b' });
    expect(getPublisherStreams(SESSION)).toEqual([]);
  });

  it('keeps the new stream when the destroyed event of the old one arrives late', () => {
    const handler = jest.fn();
    const publisher = makePublisher({ streamDestroyed: handler });
    mount(publisher);
    createStream(publisher, 'stream-a');
    createStream(publisher, 'stream-b');
    publisher.render().props.onStreamDestroyed({ nativeEvent: { streamId: 'stream-a' } });
    expect(getPublisherStreams(SESSION)).toEqual(['stream-b']);

    publisher.componentWillUnmount();

    expect(handler).toHaveBeenLastCalledWith({ streamId: 'stream-b' });
    expect(getPublisherStreams(SESSION)).toEqual([]);
  });

  it('replaces the previous stream of the same publisher when it publishes again', () => {
    const publisher = makePublisher();
    mount(publisher);
    createStream(publisher, 'stream-a');
    createStream(publisher, 'stream-b');

    publisher.componentWillUnmount();

    expect(getPublisherStreams(SESSION)).toEqual([]);
  });

  it('does not call the destroyed handler again when the native event arrives after unmount', () => {
    const handler = jest.fn();
    const publisher = makePublisher({ streamDestroyed: handler });
    mount(publisher);
    createStream(publisher, 'camera-stream');
    const element = publisher.render();

    publisher.componentWillUnmount();
    element.props.onStreamDestroyed({ nativeEvent: { streamId: 'camera-stream' } });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not emit a second destroyed event on unmount after the native one', () => {
    const handler = jest.fn();
    const camera = makePublisher({ streamDestroyed: handler });
    mount(camera);
    createStream(camera, 'camera-stream');
    camera
      .render()
      .props.onStreamDestroyed({ nativeEvent: { streamId: 'camera-stream' } });

    camera.componentWillUnmount();

    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('OTSubscriber subscribeToSelf with several local streams', () => {
  afterEach(() => clearStreams(SESSION));

  const makeSubscriber = () => {
    const sub = new OTSubscriber(
      {
        subscribeToSelf: true,
        properties: {},
        eventHandlers: {},
        streamProperties: {},
        containerStyle: {},
      },
      { sessionId: SESSION }
    );
    sub.context = { sessionId: SESSION };
    sub.setState = (update) => {
      const next = typeof update === 'function' ? update(sub.state) : update;
      if (next) sub.state = { ...sub.state, ...next };
    };
    return sub;
  };

  it('lists every local stream at construction', () => {
    addEventListener(SESSION, 'publisherStreamCreated', jest.fn());
    dispatchEvent(SESSION, 'publisherStreamCreated', { streamId: 'camera-stream' }, 'camera');
    dispatchEvent(SESSION, 'publisherStreamCreated', { streamId: 'screen-stream' }, 'screen');

    expect(makeSubscriber().state.streams).toEqual([
      'camera-stream',
      'screen-stream',
    ]);
  });

  it('removes only the destroyed local stream', () => {
    const sub = makeSubscriber();
    sub.setState({ streams: ['camera-stream', 'screen-stream'] });

    sub.publisherStreamDestroyedHandler({
      nativeEvent: { streamId: 'screen-stream' },
    });

    expect(sub.state.streams).toEqual(['camera-stream']);
  });
});
