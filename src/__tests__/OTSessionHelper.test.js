import {
  addEventListener,
  addStream,
  clearStreams,
  dispatchEvent,
  getPublisherStream,
  getStreams,
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

import {
  addEventListener as addListener,
  removeEventListener,
  dispatchEvent as dispatch,
  addStream as trackStream,
  removeStream,
  clearStreams as resetStreams,
  getStreams as readStreams,
  getPublisherStream as readPublisherStream,
  setIsConnected,
  isConnected,
} from '../helpers/OTSessionHelper';

// The registry is module-level state keyed by sessionId. To keep tests isolated,
// each test uses a unique sessionId and clears its streams afterwards.
describe('OTSessionHelper registry (stream + event + connection state)', () => {
  describe('stream tracking', () => {
    afterEach(() => {
      resetStreams('reg-streams');
    });

    it('removes a tracked stream while leaving the others', () => {
      trackStream('reg-streams', 'stream-a');
      trackStream('reg-streams', 'stream-b');

      removeStream('reg-streams', 'stream-a');

      expect(readStreams('reg-streams')).toEqual(['stream-b']);
    });

    it('is a no-op when removing from a session with no streams', () => {
      expect(() => removeStream('never-seen', 'stream-x')).not.toThrow();
      expect(readStreams('never-seen')).toEqual([]);
    });

    it('is a no-op when removing a stream id that was never added', () => {
      trackStream('reg-streams', 'stream-a');

      removeStream('reg-streams', 'stream-does-not-exist');

      expect(readStreams('reg-streams')).toEqual(['stream-a']);
    });

    it('clearStreams empties the tracked streams for a session', () => {
      trackStream('reg-streams', 'stream-a');
      trackStream('reg-streams', 'stream-b');

      resetStreams('reg-streams');

      expect(readStreams('reg-streams')).toEqual([]);
    });
  });

  describe('connection state', () => {
    it('round-trips the connected flag per session', () => {
      setIsConnected('reg-conn', true);
      expect(isConnected('reg-conn')).toBe(true);

      setIsConnected('reg-conn', false);
      expect(isConnected('reg-conn')).toBe(false);
    });

    it('tracks connection state independently per session', () => {
      setIsConnected('reg-conn-1', true);
      setIsConnected('reg-conn-2', false);

      expect(isConnected('reg-conn-1')).toBe(true);
      expect(isConnected('reg-conn-2')).toBe(false);
    });

    it('returns undefined for a session that was never set', () => {
      expect(isConnected('reg-conn-unknown')).toBeUndefined();
    });
  });

  describe('event listeners', () => {
    afterEach(() => {
      resetStreams('reg-events');
    });

    it('invokes a registered listener with the dispatched payload', () => {
      const listener = jest.fn();
      addListener('reg-events', 'streamCreated', listener);

      dispatch('reg-events', 'streamCreated', { streamId: 'stream-1' });

      expect(listener).toHaveBeenCalledWith({ streamId: 'stream-1' });
    });

    it('stops invoking a listener after it is removed', () => {
      const listener = jest.fn();
      addListener('reg-events', 'streamCreated', listener);
      removeEventListener('reg-events', 'streamCreated', listener);

      dispatch('reg-events', 'streamCreated', { streamId: 'stream-1' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('does not invoke listeners registered for a different event type', () => {
      const created = jest.fn();
      const destroyed = jest.fn();
      addListener('reg-events', 'streamCreated', created);
      addListener('reg-events', 'streamDestroyed', destroyed);

      dispatch('reg-events', 'streamCreated', { streamId: 'stream-1' });

      expect(created).toHaveBeenCalledTimes(1);
      expect(destroyed).not.toHaveBeenCalled();
    });

    it('does not invoke listeners registered for a different session', () => {
      const listener = jest.fn();
      addListener('reg-events', 'streamCreated', listener);

      dispatch('other-session', 'streamCreated', { streamId: 'stream-1' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('does not throw when dispatching to a session with no listeners', () => {
      expect(() =>
        dispatch('no-listeners', 'streamCreated', { streamId: 'stream-1' })
      ).not.toThrow();
    });
  });

  describe('publisher stream tracking via dispatchEvent', () => {
    afterEach(() => {
      resetStreams('reg-pub');
    });

    // NOTE: dispatchEvent bails out early (before the publisher-stream bookkeeping)
    // when the session has no registered listeners. So publisher-stream tracking
    // only happens once the session has at least one handler — which matches how
    // OTSession/OTSubscriber use it (listeners are always registered first).
    it('records the publisher stream on publisherStreamCreated', () => {
      addListener('reg-pub', 'publisherStreamCreated', jest.fn());

      dispatch('reg-pub', 'publisherStreamCreated', { streamId: 'pub-1' });

      expect(readPublisherStream('reg-pub')).toBe('pub-1');
    });

    it('clears the publisher stream on publisherStreamDestroyed', () => {
      addListener('reg-pub', 'publisherStreamCreated', jest.fn());
      addListener('reg-pub', 'publisherStreamDestroyed', jest.fn());

      dispatch('reg-pub', 'publisherStreamCreated', { streamId: 'pub-1' });
      expect(readPublisherStream('reg-pub')).toBe('pub-1');

      dispatch('reg-pub', 'publisherStreamDestroyed', { streamId: 'pub-1' });
      expect(readPublisherStream('reg-pub')).toBeUndefined();
    });

    it('does not record a publisher stream when the session has no listeners', () => {
      // Documents the early-return coupling: with no handler registered, the
      // publisher-stream bookkeeping is skipped entirely.
      // Uses a dedicated sessionId because eventHandlers is module-level state
      // with no reset hook — reusing 'reg-pub' would inherit listeners from
      // earlier tests and defeat the "no listeners" precondition.
      dispatch('reg-pub-empty', 'publisherStreamCreated', { streamId: 'pub-1' });

      expect(readPublisherStream('reg-pub-empty')).toBeUndefined();
    });
  });
});
