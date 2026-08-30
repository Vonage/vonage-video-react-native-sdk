import {
  addEventListener,
  addStream,
  clearStreams,
  dispatchEvent,
  getPublisherStream,
  getStreams,
  removeEventListener,
  sanitizeSessionOptions,
} from '../helpers/OTSessionHelper';

describe('OTSessionHelper', () => {
  it('dispatches publisher stream events and tracks publisher stream', () => {
    const sessionId = 'session-1';
    const listener = jest.fn();

    addEventListener(sessionId, 'publisherStreamCreated', listener);
    dispatchEvent(sessionId, 'publisherStreamCreated', {
      streamId: 'stream-1',
    });

    expect(listener).toHaveBeenCalledWith({ streamId: 'stream-1' });
    expect(getPublisherStream(sessionId)).toBe('stream-1');

    clearStreams(sessionId);
  });

  it('removeEventListener removes only the given listener, leaving others of the same type intact', () => {
    // Two components (e.g. two OTSubscribers) registered on the same session/type.
    const sessionId = 'session-remove';
    const first = jest.fn();
    const second = jest.fn();

    addEventListener(sessionId, 'streamDestroyed', first);
    addEventListener(sessionId, 'streamDestroyed', second);

    // First component unmounts and removes its own listener.
    removeEventListener(sessionId, 'streamDestroyed', first);

    dispatchEvent(sessionId, 'streamDestroyed', { streamId: 'stream-2' });

    // The removed listener must not fire...
    expect(first).not.toHaveBeenCalled();
    // ...but the surviving component's listener MUST still receive the event.
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith({ streamId: 'stream-2' });

    clearStreams(sessionId);
  });

  it('removeEventListener is a no-op for a listener that was never registered', () => {
    const sessionId = 'session-remove-noop';
    const only = jest.fn();
    const other = jest.fn();

    addEventListener(sessionId, 'streamDestroyed', only);
    removeEventListener(sessionId, 'streamDestroyed', other);

    dispatchEvent(sessionId, 'streamDestroyed', { streamId: 'stream-3' });

    expect(only).toHaveBeenCalledTimes(1);
    clearStreams(sessionId);
  });

  it('sanitizes session options', () => {
    const result = sanitizeSessionOptions({
      apiUrl: 42,
      connectionEventsSuppressed: true,
    });

    expect(result.apiUrl).toBe('');
    expect(result.connectionEventsSuppressed).toBe(true);
  });

  describe('addStream', () => {
    afterEach(() => {
      clearStreams('test-session');
    });

    it('initializes array and stores the first stream of a session', () => {
      addStream('test-session', 'stream-1');
      expect(getStreams('test-session')).toEqual(['stream-1']);
    });

    it('does not duplicate an already-added stream', () => {
      addStream('test-session', 'stream-1');
      addStream('test-session', 'stream-1');
      expect(getStreams('test-session')).toEqual(['stream-1']);
    });

    it('stores multiple distinct streams', () => {
      addStream('test-session', 'stream-1');
      addStream('test-session', 'stream-2');
      expect(getStreams('test-session')).toEqual(['stream-1', 'stream-2']);
    });
  });
});
